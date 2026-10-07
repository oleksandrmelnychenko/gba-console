import { expect, it } from 'vitest'
import { bug1274WorkbookRequest, type WorkbookLaunch } from './bug1274WorkbookLaunch'
import { cashPeriodConfigurationError } from './cashPeriod'
import { defaultDatasetRequest } from './reportDatasets'
import { cashWorkbookPresentationSupported, cloneWorkbookAliases, normalizeWorkbookDataset, readWorkbookSelection,
  workbookConfigurationError } from './workbookPresentation'
import { presentedCashDataset, presentedCashRequest, presentedDayDataset, presentedSettlementDataset } from './workbookPresentation.test-fixtures'
import { retainStoredTemplateFields } from './reportTemplateDraft'
import { reportWorkspaceDraftCompatibility } from './reportWorkspaceDraftCompatibility'
import { encodeReportWorkspaceSnapshot } from './reportWorkspaceDraft'

it('accepts ordered distinct subsets and exact Pascal/camel selector fields without numeric coercion', () => {
  expect(readWorkbookSelection({ Version: 1, AdditionalFields: [61, 30], Ordering: null })).toEqual({ version: 1, additionalFields: [61, 30], ordering: null })
  expect(readWorkbookSelection({ version: 1, additionalFields: [], ordering: null })).toEqual({ version: 1, additionalFields: [], ordering: null })
  expect(readWorkbookSelection({ version: 1, additionalFields: ['30'], ordering: null })).toBeNull()
})
it('refuses unknown versions, repeated properties/fields, missing ordering and unknown settings', () => {
  for (const value of [{ version: 2, additionalFields: [], ordering: null }, { version: 1, additionalFields: [30, 30], ordering: null },
    { version: 1, Version: 1, additionalFields: [], ordering: null }, { version: 1, additionalFields: [] },
    { version: 1, additionalFields: [], ordering: null, future: true }]) expect(readWorkbookSelection(value)).toBeNull()
})
it('refuses ambiguous top-level aliases while preserving original saved bytes and unknown fields', () => {
  const request = { ...presentedCashRequest(), WorkbookPresentation: { Version: 1, AdditionalFields: [], Ordering: null } }
  const copy = structuredClone(request)
  expect(workbookConfigurationError(request, presentedCashDataset)).toBeTruthy()
  expect(cloneWorkbookAliases(request)).toEqual({ workbookPresentation: request.workbookPresentation, WorkbookPresentation: request.WorkbookPresentation })
  expect(request).toEqual(copy)
  expect(workbookConfigurationError({ ...presentedCashRequest(), WORKBOOKPRESENTATION: {} } as typeof request)).toBeTruthy()
})
it('requires the complete current capability and account-only grouped declaration', () => {
  expect(cashWorkbookPresentationSupported(presentedCashDataset)).toBe(true)
  const old = { ...presentedCashDataset, workbookPresentation: undefined }
  expect(workbookConfigurationError(presentedCashRequest(), old)).toContain('сервер')
  expect(cashWorkbookPresentationSupported({ ...presentedCashDataset, groupedCashPeriod: {} })).toBe(false)
  expect(normalizeWorkbookDataset({ ...presentedCashDataset, WorkbookPresentation: presentedCashDataset.workbookPresentation })).toBeNull()
  expect(normalizeWorkbookDataset({ ...presentedCashDataset, workbookPresentation: { version: 2 } })).toBeNull()
  for (const dataset of [presentedCashDataset, presentedSettlementDataset]) {
    expect(normalizeWorkbookDataset({ ...dataset, workbookPresentation: { ...(dataset.workbookPresentation as Record<string, unknown>), orderings: [''] } })).toBeNull()
  }
  expect(normalizeWorkbookDataset({ ...presentedDayDataset, workbookPresentation: { ...(presentedDayDataset.workbookPresentation as Record<string, unknown>),
    orderings: ['MonthAscending', ''] } })).toBeNull()
})
it('allows the account-only request without modifying financial measures and refuses scalar/old row shapes', () => {
  const request = presentedCashRequest(), before = structuredClone(request)
  expect(cashPeriodConfigurationError(request, presentedCashDataset, '2026-10-06')).toBeNull()
  expect(request).toEqual(before)
  expect(workbookConfigurationError({ ...request, sorted: { ...request.sorted, Row: [] } })).toBeTruthy()
  expect(workbookConfigurationError({ ...request, groupedCashPeriod: undefined })).toBeTruthy()
  expect(workbookConfigurationError({ ...request, dataSource: 38 })).toBeTruthy()
})
it('keeps manager/region Fenix-only but permits currency-only AMG and requires exact settlement layouts', () => {
  const request = defaultDatasetRequest(presentedSettlementDataset, '2026-10-01', '2026-10-04')
  request.workbookPresentation = { version: 1, additionalFields: [60, 61], ordering: null }
  expect(workbookConfigurationError(request, presentedSettlementDataset)).toBeNull()
  const amg = { ...request, groupedSettlementPeriod: { Version: 1, SourceWorld: 'Amg', CurrencyBasis: 'SettlementCurrency' } }
  expect(workbookConfigurationError(amg, presentedSettlementDataset)).toBeTruthy()
  expect(workbookConfigurationError({ ...amg, workbookPresentation: { version: 1, additionalFields: [30], ordering: null } }, presentedSettlementDataset)).toBeNull()
  expect(workbookConfigurationError({ ...request, sorted: { ...request.sorted, Row: [] } })).toBeTruthy()
})
it('binds retained Article/Top and MonthAscending only to the operational day basis', () => {
  const request = defaultDatasetRequest(presentedDayDataset, '2026-10-01', '2026-10-04')
  request.workbookPresentation = { version: 1, additionalFields: [2, 3], ordering: 'MonthAscending' }
  expect(workbookConfigurationError(request, presentedDayDataset)).toBeNull()
  expect(workbookConfigurationError({ ...request, dayOrganizationBasis: 1 }, presentedDayDataset)).toBeTruthy()
  expect(workbookConfigurationError({ ...presentedCashRequest(), workbookPresentation: request.workbookPresentation })).toBeTruthy()
})
const launch = (fileName: string, dataset: WorkbookLaunch['dataset']): WorkbookLaunch => ({ fileName, dataset, label: '', notice: '' })
it('applies the retained day shortcut settings without changing the ordinary default or creating product values', () => {
  const ordinary = defaultDatasetRequest(presentedDayDataset, '2026-10-01', '2026-10-04'), original = structuredClone(ordinary)
  const selected = bug1274WorkbookRequest(ordinary, launch('ВП.xls', presentedDayDataset))
  expect(selected.workbookPresentation).toEqual({ version: 1, additionalFields: [2, 3], ordering: 'MonthAscending' })
  expect(selected.sorted.Row.map(row => row.type)).toEqual([3, 4])
  expect(ordinary).toEqual(original); expect(ordinary).not.toHaveProperty('workbookPresentation')
})
it('uses only account rows with Currency/Kind for the new cash shortcut while retaining legacy capability behavior', () => {
  const request = defaultDatasetRequest(presentedCashDataset, '2026-10-01', '2026-10-04')
  const selected = bug1274WorkbookRequest(request, launch('Ведомость по денежным средствам.xls', presentedCashDataset))
  expect(selected.sorted.Row.map(row => row.type)).toEqual([40])
  expect(selected.workbookPresentation).toEqual({ version: 1, additionalFields: [30, 33], ordering: null })
  expect(selected.sorted.Measurements).toEqual(request.sorted.Measurements)
  const legacy = { ...presentedCashDataset, workbookPresentation: undefined }
  expect(bug1274WorkbookRequest(request, launch('Ведомость по денежным средствам.xls', legacy)).sorted.Row.map(row => row.type)).toEqual([40, 44, 43])
})
it('defaults full settlements to manager/region but excludes both from the debtor form', () => {
  const request = defaultDatasetRequest(presentedSettlementDataset, '2026-10-01', '2026-10-04')
  const full = bug1274WorkbookRequest(request, launch('Взаємороз всі.xls', presentedSettlementDataset))
  const debtor = bug1274WorkbookRequest(request, { ...launch('ДБіторка.xls', presentedSettlementDataset), currencyAxis: false })
  expect(full.workbookPresentation).toEqual({ version: 1, additionalFields: [30, 60, 61], ordering: null })
  expect(debtor.workbookPresentation).toEqual({ version: 1, additionalFields: [30], ordering: null })
  expect(debtor.sorted.Row.map(row => row.type)).toEqual([4, 76])
  expect(bug1274WorkbookRequest({ ...request, groupedSettlementPeriod: { Version: 1, SourceWorld: 'Amg', CurrencyBasis: 'SettlementCurrency' } },
    launch('Взаємороз всі.xls', presentedSettlementDataset)).workbookPresentation).toEqual({ version: 1, additionalFields: [30], ordering: null })
})
it('round-trips account-only draft and selector without dropping unknown stored fields, and refuses old server recovery', () => {
  const data = presentedCashRequest()
  const snapshot = { name: 'Каса', data, measurements: [], activeTemplate: null, previousPeriod: { from: data.from, to: data.to } }
  expect(encodeReportWorkspaceSnapshot(snapshot).ok).toBe(true)
  expect(reportWorkspaceDraftCompatibility(snapshot, presentedCashDataset)).toBeNull()
  expect(reportWorkspaceDraftCompatibility(snapshot, { ...presentedCashDataset, workbookPresentation: undefined })).toBeTruthy()
  expect(retainStoredTemplateFields({ ...data, future: { retained: true } } as typeof data,
    { ...data, workbookPresentation: undefined })).toMatchObject({ future: { retained: true }, workbookPresentation: undefined })
})
