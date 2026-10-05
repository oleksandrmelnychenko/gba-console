import { expect, it } from 'vitest'
import { emptyPurchases, missingPurchases, purchasesCapability, purchasesProduct, purchasesResponse } from '../testing/originalPurchasesFixtures'
import { isPurchasesCapability, normalizePurchases, purchasesMeasures, purchasesMilli, purchasesRequest, purchasesResultRequest, validatePurchasesRequest } from './originalPurchases'

it('requires the exact own module dynamic-query policy and base-only default without native claims', () => {
  expect(isPurchasesCapability(purchasesCapability)).toBe(true)
  for (const field of ['World', 'SourceId', 'DefinitionSha256', 'ModuleSha256', 'UniversalReportModuleSha256', 'RegisterUuid', 'QueryPolicy', 'DatePolicy', 'QuantityPolicy', 'ZeroRowPolicy'])
    expect(isPurchasesCapability({ ...purchasesCapability, [field]: 'foreign' })).toBe(false)
  for (const field of ['HumanChoicesAvailable', 'SourceSyncEnabled', 'NormalInputsReadinessVerified', 'NativeDateParametersVerified', 'NativeVirtualRegistrarTotalsVerified', 'NativeZeroGroupSuppressionVerified', 'NativeNullNumericSemanticsVerified', 'SourceParityVerified', 'OriginalFullTaskAccepted', 'AppliesFxConversion'])
    expect(isPurchasesCapability({ ...purchasesCapability, [field]: true })).toBe(false)
  expect(isPurchasesCapability({ ...purchasesCapability, DefaultMeasures: [...purchasesMeasures] })).toBe(false)
  expect(purchasesRequest(purchasesCapability, '2026-09-10', '2026-09-12').Measures).toEqual(['КоличествоБазовыхЕд'])
})
it.each(purchasesMeasures)('selects canonical resource %s without substituting another quantity or receipt dataset', measure => {
  const request = purchasesRequest(purchasesCapability, '2026-09-10', '2026-09-12', [measure])
  const result = normalizePurchases(purchasesResponse([measure]), request)
  expect(Object.keys(result.Totals ?? {})).toEqual([measure]); expect(result.Measures).toEqual([measure])
})
it('detaches all five selectors and keeps same-reference projects distinct by type and table', () => {
  const request = purchasesRequest(purchasesCapability, '2026-09-10', '2026-09-12')
  request.Statuses = ['B'.repeat(32), 'A'.repeat(32)]; request.Counterparties = ['C'.repeat(32)]; request.Products = [purchasesProduct]
  request.Divisions = ['D'.repeat(32)]; request.Projects = [`08:00000061:${purchasesProduct}`, `08:00000081:${purchasesProduct}`]
  const detached = validatePurchasesRequest(request); request.Statuses[0] = 'F'.repeat(32); request.Projects.length = 0
  expect(detached.Statuses).toEqual(['A'.repeat(32), 'B'.repeat(32)]); expect(detached.Projects).toHaveLength(2)
  expect(() => validatePurchasesRequest({ ...detached, Projects: [purchasesProduct] })).toThrow()
  expect(() => validatePurchasesRequest({ ...detached, Products: [purchasesProduct, purchasesProduct] })).toThrow()
})
it('refuses invalid days full-year periods empty resources and overlarge selector scopes before dispatch', () => {
  for (const [from, through] of [['2026-02-29', '2026-03-01'], ['2026-09-12', '2026-09-10'], ['2026-09-10', '2027-09-10']])
    expect(() => purchasesRequest(purchasesCapability, from, through)).toThrow()
  const request = purchasesRequest(purchasesCapability, '2026-09-10', '2026-09-12')
  expect(() => validatePurchasesRequest({ ...request, Measures: [] })).toThrow()
  expect(() => validatePurchasesRequest({ ...request, Products: Array(257).fill(purchasesProduct) })).toThrow()
})
it('rechecks every echoed selector and date independently before showing or exporting the response', () => {
  const request = purchasesRequest(purchasesCapability, '2026-09-10', '2026-09-12'), response = purchasesResponse()
  for (const field of Object.keys(response.Selectors)) expect(() => normalizePurchases({ ...response, Selectors: { ...response.Selectors, [field]: [purchasesProduct] } }, request)).toThrow()
  expect(() => normalizePurchases({ ...response, From: '2026-09-01' }, request)).toThrow()
  expect(() => normalizePurchases({ ...response, Measures: ['КоличествоОборот'] }, request)).toThrow()
  expect(() => normalizePurchases({ ...response, World: 'amg' }, request)).toThrow()
})
it('keeps exact rational parent rounding instead of summing rounded product quantities', () => {
  const request = purchasesRequest(purchasesCapability, '2026-09-10', '2026-09-12', purchasesMeasures)
  const result = normalizePurchases(purchasesResponse(purchasesMeasures), request)
  expect(result.Rows[0].Children[0].Children.map(row => row.Values.КоличествоЕдиницОтчетов)).toEqual(['0.333', '0.333'])
  expect(result.Totals?.КоличествоЕдиницОтчетов).toBe('0.667')
  expect(purchasesResultRequest(result)).toEqual(request)
})
it('validates ordered hierarchy fields and sibling identity while keeping keys in different families separate', () => {
  const request = purchasesRequest(purchasesCapability, '2026-09-10', '2026-09-12'), result = purchasesResponse()
  result.Rows[0].Children[0].Key = result.Rows[0].Key
  expect(normalizePurchases(result, request).Available).toBe(true)
  result.Rows[0].Children[0].Field = 'Номенклатура'; expect(() => normalizePurchases(result, request)).toThrow()
  const duplicate = purchasesResponse(); duplicate.Rows[0].Children[0].Children[1].Key = purchasesProduct
  expect(() => normalizePurchases(duplicate, request)).toThrow()
  expect(() => normalizePurchases({ ...purchasesResponse(), Rows: [{ ...purchasesResponse().Rows[0], Children: [] }] }, request)).toThrow()
})
it.each(['1', '01.000', '-0.000', '1.00', '1e3', '+1.000'])('rejects noncanonical quantity %s rather than converting through floating point', value => {
  expect(() => purchasesMilli(value)).toThrow()
})
it('retains wide signed quantity strings and returns a detached result', () => {
  const request = purchasesRequest(purchasesCapability, '2026-09-10', '2026-09-12'), response = purchasesResponse()
  response.Totals = { КоличествоБазовыхЕд: '-9007199254740993.001' }
  const detached = normalizePurchases(response, request); response.Totals.КоличествоБазовыхЕд = '0.000'; response.Rows.length = 0
  expect(detached.Totals?.КоличествоБазовыхЕд).toBe('-9007199254740993.001'); expect(detached.Rows).toHaveLength(1)
})
it('distinguishes authenticated complete empty from absent input without accepting partial amounts', () => {
  const request = purchasesRequest(purchasesCapability, '2026-09-10', '2026-09-12')
  expect(normalizePurchases(emptyPurchases(), request).Totals).toEqual({ КоличествоБазовыхЕд: '0.000' })
  expect(normalizePurchases(missingPurchases(), request).Totals).toBeNull()
  expect(() => normalizePurchases({ ...missingPurchases(), Totals: { КоличествоБазовыхЕд: '0.000' } }, request)).toThrow()
  expect(() => normalizePurchases({ ...emptyPurchases(), Totals: { КоличествоБазовыхЕд: '1.000' } }, request)).toThrow()
})
it('retains contributing zero rows rather than imposing native virtual zero suppression', () => {
  const request = purchasesRequest(purchasesCapability, '2026-09-10', '2026-09-12'), result = purchasesResponse()
  result.Totals = { КоличествоБазовыхЕд: '0.000' }
  result.Rows[0].Values = { КоличествоБазовыхЕд: '0.000' }
  result.Rows[0].Children[0].Values = { КоличествоБазовыхЕд: '0.000' }
  result.Rows[0].Children[0].Children.forEach(row => { row.Values = { КоличествоБазовыхЕд: '0.000' } })
  const normalized = normalizePurchases(result, request)
  expect(normalized.Code).toBe('original_purchases_declared_calendar_complete')
  expect(normalized.Rows[0].Children[0].Children).toHaveLength(2)
})
it('a matching scope echo cannot admit a product row outside its exact selected reference', () => {
  const request = purchasesRequest(purchasesCapability, '2026-09-10', '2026-09-12'), result = purchasesResponse()
  request.Products = [purchasesProduct]; result.Selectors.Номенклатура = [purchasesProduct]
  expect(() => normalizePurchases(result, request)).toThrow()
  result.Rows[0].Children[0].Children.pop()
  expect(normalizePurchases(result, request).Available).toBe(true)
})
