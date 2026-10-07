import { expect, it } from 'vitest'
import { createCurrencyRateDynamicsRequest, currencyRateDynamicsCellText, currencyRateDynamicsDefinitionLabel,
  defaultCurrencyRateDynamicsMonth, isCurrencyRateDynamicsCapabilities, isCurrencyRateDynamicsCatalogueEntry,
  isCurrencyRateDynamicsDefinition, normalizeCurrencyRateDynamicsDefinitions, normalizeCurrencyRateDynamicsReport } from './currencyRateDynamics'
import { currencyDynamicsCapability, currencyDynamicsCatalogueEntry, currencyDynamicsDefinition, currencyDynamicsReport } from './currencyRateDynamics.test-fixtures'
import { activeClientsCapability } from './activeClients.test-fixtures'

it('recognizes the original source and exact four captions independently of native dataset19', () => {
  const capability = currencyDynamicsCapability(), report = currencyDynamicsCatalogueEntry()
  expect(isCurrencyRateDynamicsCapabilities(capability)).toBe(true)
  expect(isCurrencyRateDynamicsCatalogueEntry(report)).toBe(true)
  expect(isCurrencyRateDynamicsCapabilities(activeClientsCapability())).toBe(false)
  expect(isCurrencyRateDynamicsCapabilities({ ...capability, RateKind: 'government' })).toBe(false)
  expect(isCurrencyRateDynamicsCapabilities({ ...capability, Columns: [...capability.Columns].reverse() })).toBe(false)
  expect(isCurrencyRateDynamicsCapabilities({ ...capability, Parameters: [] })).toBe(false)
  report.Sources[0].World = 'amg'
  expect(isCurrencyRateDynamicsCatalogueEntry(report)).toBe(false)
})
it('serializes only month and exact bigint definition without rounding or inverse-pair guesses', () => {
  const definition = currencyDynamicsDefinition(), request = createCurrencyRateDynamicsRequest(currencyDynamicsCapability(), '2026-01', definition)
  expect(Object.keys(request)).toEqual(['Version', 'SourceIdentity', 'Month', 'RateDefinitionId'])
  expect(request.RateDefinitionId).toBe('9007199254740993')
  expect(defaultCurrencyRateDynamicsMonth('2026-01-15')).toBe('2025-12')
  expect(currencyRateDynamicsDefinitionLabel(definition)).toContain('USD (Долар США) → UAH (Гривня)')
  for (const changed of [{ ...definition, RateDefinitionId: '01' }, { ...definition, RateDefinitionId: '9223372036854775808' },
    { ...definition, RateDefinitionId: 9007199254740992 }, { ...definition, TargetCurrencyId: definition.BaseCurrencyId }])
    expect(isCurrencyRateDynamicsDefinition(changed)).toBe(false)
  expect(() => createCurrencyRateDynamicsRequest({ ...currencyDynamicsCapability(), Executable: false }, '2026-09', definition)).toThrow()
  expect(() => createCurrencyRateDynamicsRequest(currencyDynamicsCapability(), '9999-12', definition)).toThrow()
})
it('preserves wide manual rates and raw fractional percent while rounding only the displayed cell', () => {
  const response = currencyDynamicsReport(), definition = currencyDynamicsDefinition(), raw = response.Cells[2].Value
  const request = createCurrencyRateDynamicsRequest(currencyDynamicsCapability(), response.Month, definition)
  expect(normalizeCurrencyRateDynamicsReport(response, request, definition)).toBe(response)
  expect(currencyRateDynamicsCellText(raw, 2)).toBe('21,24')
  const wide = structuredClone(response)
  wide.Cells[0].Value = wide.Cells[1].Value = '9999999999999999.12345678901234'
  wide.Inputs.Current.Amount = wide.Inputs.Previous.Amount = wide.Cells[0].Value
  wide.Cells[2].Value = wide.Cells[3].Value = '0'
  expect(normalizeCurrencyRateDynamicsReport(wide, request, definition)).toBe(wide)
  expect(currencyRateDynamicsCellText(wide.Cells[0].Value, null)).toBe('9999999999999999,12345678901234')
  expect(response.Cells[2].Value).toBe(raw)
  expect(response.DocumentURL).toBe('/files/currency-dynamics.xlsx')
})
it('keeps ambiguous current history NULL while a server-known previous zero still supplies100', () => {
  const response = currencyDynamicsReport(), definition = currencyDynamicsDefinition()
  response.Inputs.Current = { Available: false, HistoryId: null, Created: null, Amount: null, Code: 'latest_point_ambiguous' }
  response.Inputs.Previous.Amount = '0'; response.CalculationCode = 'rate_history_unavailable'
  response.Cells.forEach((cell, index) => { cell.Value = index === 1 ? '0' : index === 2 ? '100' : null; cell.Available = cell.Value !== null })
  expect(normalizeCurrencyRateDynamicsReport(response, createCurrencyRateDynamicsRequest(currencyDynamicsCapability(), response.Month, definition), definition)).toBe(response)
  expect(response.Cells.map(cell => cell.Value)).toEqual([null, '0', '100', null])
})
it('retains known courses and absolute difference when only percentage is outside the server calculation range', () => {
  const response = currencyDynamicsReport(), definition = currencyDynamicsDefinition()
  response.Cells[0].Value = response.Inputs.Current.Amount = '9999999999999999.99999999999999'
  response.Cells[1].Value = response.Inputs.Previous.Amount = '0.00000000000001'
  response.Cells[3].Value = '9999999999999999.99999999999998'
  response.Cells[2] = { ...response.Cells[2], Value: null, Available: false }; response.CalculationCode = 'percentage_range_unavailable'
  expect(normalizeCurrencyRateDynamicsReport(response, createCurrencyRateDynamicsRequest(currencyDynamicsCapability(), response.Month, definition), definition).Cells.map(cell => cell.Value))
    .toEqual(['9999999999999999.99999999999999', '0.00000000000001', null, '9999999999999999.99999999999998'])
})
it('rejects another series, reversed pair, mismatched month, shifted stored-date timezone or invented unavailable zero', () => {
  const response = currencyDynamicsReport(), definition = currencyDynamicsDefinition(), request = createCurrencyRateDynamicsRequest(currencyDynamicsCapability(), response.Month, definition)
  for (const changed of [{ ...response, RateDefinition: currencyDynamicsDefinition(true) },
    { ...response, RateDefinition: { ...definition, BaseCurrencyId: definition.TargetCurrencyId, TargetCurrencyId: definition.BaseCurrencyId,
      BaseCode: definition.TargetCode, TargetCode: definition.BaseCode } },
    { ...response, Month: '2026-08' }, { ...response, PreviousPeriod: response.CurrentPeriod },
    { ...response, Inputs: { ...response.Inputs, Current: { ...response.Inputs.Current, Created: response.Inputs.Current.Created + 'Z' } } },
    { ...response, Inputs: { ...response.Inputs, Current: { Available: false, HistoryId: null, Created: null, Amount: '0', Code: 'history_missing' } } }])
    expect(() => normalizeCurrencyRateDynamicsReport(changed, request, definition)).toThrow()
  expect(() => normalizeCurrencyRateDynamicsDefinitions([definition, definition])).toThrow()
})
