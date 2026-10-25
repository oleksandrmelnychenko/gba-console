import { describe, expect, it } from 'vitest'
import { presentationCurrencySupported, presentationCurrencyError, readPresentationCurrency, readResolvedPresentationCurrency, requestPresentationCurrency, isPresentationCurrencyMoneyMeasure, currencyNeutralMeasureLabel } from './reportPresentationCurrency'
import { currencyCapability, currencyDataset, currencyRequest, currencySelection } from './reportPresentationCurrency.test-fixtures'
import { datasetConfigurationError } from './reportDatasets'
import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { validateStockReportRequest } from '../api/reportsApi'
import { buildReportBuilderRequest } from './reportBuilderRequest'
import { retainStoredTemplateFields } from './reportTemplateDraft'
import { reportValueUnit } from './reportNumberPresentation'

describe('document-date report currency contract', () => {
  it.each([undefined, null, {}, { ...currencyCapability, version: 2 }, { ...currencyCapability, rateFamily: 'nbu' },
    { ...currencyCapability, datePolicy: 'today' }, { ...currencyCapability, allowedProfitReadModes: [0, 1] },
    { ...currencyCapability, lookupPath: '/untrusted' }])('does not admit unconfirmed metadata %j', cap => {
    const dataset = { ...currencyDataset, currentFinancialPresentationCurrency: cap }
    expect(presentationCurrencySupported(dataset)).toBe(false)
    expect(presentationCurrencyError(currencyRequest(), dataset)).toContain('Сервер не підтвердив')
  })
  it.each([undefined, null])('keeps legacy EUR requests unchanged without any capability: %j', selection => {
    const data = { ...currencyRequest(), presentationCurrency: selection }, before = structuredClone(data)
    expect(presentationCurrencyError(data)).toBeNull()
    expect(data).toEqual(before)
  })
  it.each([{ profitReadMode: 1 }, { profitReadMode: undefined }, { dayOrganizationBasis: 1 }, { dayOrganizationBasis: undefined }, { dataSource: 38 }])('refuses unsupported scope without clearing saved selection %j', change => {
    const data = { ...currencyRequest(), ...change }, before = structuredClone(data)
    expect(datasetConfigurationError(data, currencyDataset)).toContain('Валюта звіту доступна лише')
    expect(data).toEqual(before)
  })
  it.each(['', '00000000-0000-0000-0000-000000000000', '123', '11111111222233334444555555555555', ' 11111111-2222-3333-4444-555555555555'])('rejects malformed or noncanonical IDs %s', currencyNetUid => {
    expect(readPresentationCurrency({ version: 1, currencyNetUid })).toBeUndefined()
  })
  it('validates currency before submission and retains all financial axes/negative filters', () => {
    const request = currencyRequest(), before = structuredClone(request)
    expect(datasetConfigurationError(request, currencyDataset)).toBeNull()
    expect(() => validateStockReportRequest(request, currencyDataset)).not.toThrow()
    expect(() => validateStockReportRequest({ ...request, presentationCurrency: { ...currencySelection, rateFamily: 'nbu' } }, currencyDataset)).toThrow('Некоректна валюта')
    expect(presentationCurrencyError({ ...request, PresentationCurrency: currencySelection }, currencyDataset)).toContain('неоднозначно')
    expect(request).toEqual(before)
  })
  it('retains currency in JSON templates and request rebuilds without injecting legacy defaults', () => {
    const data = currencyRequest()
    const wire = { Id: '10000000-0000-4000-8000-000000000001', Revision: 1, Name: 'Валюта', UpdatedAtUtc: '2026-10-25T00:00:00Z',
      Data: { DataSource: 35, From: data.from, To: data.to, Sorted: data.sorted, Selections: data.selections, ProfitReadMode: 0, DayOrganizationBasis: 0 } }
    expect(normalizeSavedTemplate(wire).Data).not.toHaveProperty('presentationCurrency')
    for (const key of ['presentationCurrency', 'PresentationCurrency']) {
      const loaded = normalizeSavedTemplate({ ...wire, Data: { ...wire.Data, [key]: currencySelection } })
      expect(requestPresentationCurrency(loaded.Data)).toEqual(currencySelection)
      expect(presentationCurrencyError(loaded.Data, currencyDataset)).toBeNull()
    }
    const builder = { ...data, dataSource: 35, rowGroups: data.sorted.Row, colGroups: data.sorted.Col, measurements: [],
      ordering: undefined, filterExpression: undefined, topGroups: undefined, valuationClientAgreementId: undefined }
    expect(buildReportBuilderRequest(builder).presentationCurrency).toEqual(currencySelection)
    expect(buildReportBuilderRequest({ ...builder, presentationCurrency: undefined })).not.toHaveProperty('presentationCurrency')
  })
  it('allows catalog-defined codes beyond four currencies and labels exact resolved units only', () => {
    const semantics = { kind: 'money' as const, currencyPolicy: 'CAD retail', unitPolicy: 'currency', aggregation: 'sum', scalable: true, defaultDecimalPlaces: 2 }
    const value = { ...currencySelection, code: 'CAD retail', rateFamily: 'commercialGba', datePolicy: 'ownDocument' }
    expect(readResolvedPresentationCurrency(value)).toEqual(value)
    expect(reportValueUnit(semantics, { version: 1, moneyScale: 1000 }, value.code)).toBe('тис. CAD retail')
    expect(readResolvedPresentationCurrency({ ...value, code: 'CAD\n' })).toBeUndefined()
    expect(reportValueUnit({ ...semantics, kind: 'percent', currencyPolicy: 'notApplicable' }, undefined, value.code)).toBe('%')
  })
})

it.each(['presentationCurrency', 'PresentationCurrency'])('does not resurrect a restored %s after explicit reset to legacy EUR', key => {
  const request = currencyRequest()
  const { presentationCurrency, ...plain } = request
  const stored = { ...plain, [key]: presentationCurrency, futureSettings: { retained: true } }
  const unchanged = structuredClone(stored)
  const reset = retainStoredTemplateFields(stored, plain)
  expect(reset).not.toHaveProperty('presentationCurrency')
  expect(reset).not.toHaveProperty('PresentationCurrency')
  expect(reset).toMatchObject({ futureSettings: { retained: true } })
  expect(reset.sorted).toEqual(request.sorted)
  expect(reset.selections).toEqual(request.selections)
  expect(stored).toEqual(unchanged)
})

it('neutralizes constructor currency captions only at the unit suffix and never percentages or arbitrary names', () => {
  expect(currencyNeutralMeasureLabel('Продажі, EUR')).toBe('Продажі, у валюті звіту')
  expect(currencyNeutralMeasureLabel('тис. EUR')).toBe('тис. у валюті звіту')
  expect(currencyNeutralMeasureLabel('Євро')).toBe('у валюті звіту')
  expect(currencyNeutralMeasureLabel('Європа')).toBe('Європа')
  expect(currencyNeutralMeasureLabel('EUR спеціальний підпис')).toBe('EUR спеціальний підпис')
  expect(currencyNeutralMeasureLabel('Рентабельність, %')).toBe('Рентабельність, %')
  expect([2,3,4,6,7,8,10,11,12].every(isPresentationCurrencyMoneyMeasure)).toBe(true)
  expect([0,14,15,81].some(isPresentationCurrencyMoneyMeasure)).toBe(false)
})
