import { expect, it } from 'vitest'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import { normalizeSavedTemplate, parseReportDatasets } from '../api/reportWorkspaceApi'
import { availableBug1274WorkbookLaunches, bug1274WorkbookRequest, CASH_READ_MODE_NOTICE } from './bug1274WorkbookLaunch'
import { cashPeriodConfigurationError, previousKyivDay } from './cashPeriod'
import { cashPeriodManagementRequest } from './cashPeriod.test-fixtures'
import { cashReadModeConfigurationError, isCashReadModeCapability, requestCashReadMode } from './cashReadMode'
import { cashModeDataset as dataset, cashReadModeCapability as capability } from './cashReadMode.test-fixtures'
import { groupedCashDataset, groupedCashWorkbookDataset } from './groupedCashPeriod.test-fixtures'
import { settlementMaximumDate } from './groupedSettlementPeriod'
import { buildReportBuilderRequest } from './reportBuilderRequest'
import { datasetConfigurationError, datasetMeasurements, datasetPresetRequest, defaultDatasetRequest, withDefaultReadModes } from './reportDatasets'
import { reportDatasets } from './reportDatasets.test-fixtures'
import { retainStoredTemplateFields } from './reportTemplateDraft'
import { reportWorkspaceDraftCompatibility } from './reportWorkspaceDraftCompatibility'
import { settlementModeDataset } from './settlementReadMode.test-fixtures'
import type { ReportDataset } from '../types'

const today = '2026-10-13'
const hasMode = (value: object) => Object.keys(value).some(key => key.toLowerCase() === 'cashreadmode')
const request = (mode: unknown) => ({ ...defaultDatasetRequest(dataset, '2025-01-01', today), cashReadMode: mode })
const { cashReadMode: _capability, ...plain } = dataset
void _capability
const unmarked = (capable: ReportDataset, from: string, to: string) => {
  const request = defaultDatasetRequest(capable, from, to)
  delete request.cashReadMode
  return request
}
const cashLaunch = (datasets: ReportDataset[]) => availableBug1274WorkbookLaunches(datasets)
  .find(launch => launch.fileName === 'Ведомость по денежным средствам.xls')!

it('accepts only the exact four-field capability with case-insensitive names', () => {
  expect(isCashReadModeCapability(capability)).toBe(true)
  expect(isCashReadModeCapability(Object.fromEntries(Object.entries(capability).map(([key, value]) => [key.toLowerCase(), value])))).toBe(true)
  const { LegacyInferencePreserved: _legacy, ...missing } = capability
  void _legacy
  for (const value of [null, [], {}, missing, { ...capability, Extra: true }, { ...capability, version: 1 },
    { ...missing, CurrentDocumentsMaximumDays: 120 }, { ...capability, Version: 2 }, { ...capability, SupportedModes: [1, 0] },
    { ...capability, SupportedModes: ['0', '1'] }, { ...capability, SupportedModes: [0] }, { ...capability, SupportedModes: [0, 1, 2] },
    { ...capability, CurrentDocumentsMaximumMonths: 121 }, { ...capability, CurrentDocumentsMaximumMonths: '120' },
    { ...capability, LegacyInferencePreserved: false }])
    expect(isCashReadModeCapability(value)).toBe(false)
})

it('normalizes the dataset capability and hides unknown or misplaced ones without refusing the dataset list', () => {
  expect(parseReportDatasets([{ ...plain, CashReadMode: capability }])[0].cashReadMode).toEqual(capability)
  for (const invalid of [{ ...capability, Extra: 1 }, { ...capability, CurrentDocumentsMaximumMonths: 60 }, null, 'yes']) {
    const [parsed] = parseReportDatasets([{ ...plain, cashReadMode: invalid }])
    expect(hasMode(parsed)).toBe(false)
    expect(cashLaunch([parsed]).notice).not.toContain(CASH_READ_MODE_NOTICE)
  }
  expect(hasMode(parseReportDatasets([{ ...plain, cashReadMode: capability, CashReadMode: capability }])[0])).toBe(false)
  const parsed = parseReportDatasets([{ ...reportDatasets[0], cashReadMode: capability }, { ...settlementModeDataset, cashReadMode: capability }, plain])
  expect(parsed.map(item => item.DataSource)).toEqual([reportDatasets[0].DataSource, 41, 40])
  expect(parsed.some(hasMode)).toBe(false)
  expect(parsed[1].settlementReadMode).toEqual(settlementModeDataset.settlementReadMode)
})

it.each([0, 1])('admits explicit mode %s on grouped cash from 01.01.2025 for 120 months to today', mode => {
  expect(cashPeriodConfigurationError(request(mode), dataset, today)).toBeNull()
  expect(cashPeriodConfigurationError({ ...request(mode), from: today }, dataset, today)).toBeNull()
  expect(cashPeriodConfigurationError({ ...request(mode), from: '2024-12-31' }, dataset, today)).toContain('120')
  expect(cashPeriodConfigurationError({ ...request(mode), to: '2026-10-14' }, dataset, today)).toContain('сьогодні')
  expect(cashPeriodConfigurationError({ ...request(mode), to: '2034-12-31' }, dataset, '2035-01-01')).toBeNull()
  expect(cashPeriodConfigurationError({ ...request(mode), to: '2035-01-01' }, dataset, '2035-01-01')).toContain('120')
  expect(datasetConfigurationError({ ...request(mode), to: '2026-09-30' }, dataset)).toBeNull()
  expect(settlementMaximumDate(40, undefined, today, mode)).toBe(today)
})

it('keeps the legacy grouped and exact cash periods to 31 completed days', () => {
  expect(cashPeriodConfigurationError({ ...request(undefined), to: '2026-10-12' }, dataset, today)).toContain('31')
  expect(cashPeriodConfigurationError({ ...request(null), to: '2026-10-12' }, dataset, today)).toContain('31')
  expect(cashPeriodConfigurationError({ ...request(undefined), from: '2026-10-01', to: today }, dataset, today)).toContain('завершені дні')
  expect(cashPeriodConfigurationError({ ...request(undefined), from: '2026-10-01', to: '2026-10-12' }, plain, today)).toBeNull()
  expect(settlementMaximumDate(40, undefined, today)).toBe('2026-10-12')
  expect(settlementMaximumDate(40, undefined, today, null)).toBe('2026-10-12')
})

it('rejects malformed, duplicated, misplaced or unconfirmed modes and single-account scopes', () => {
  for (const mode of ['0', true, 2, {}, []])
    expect(cashPeriodConfigurationError(request(mode), dataset, today)).toContain('Некоректне')
  expect(cashPeriodConfigurationError({ ...request(0), CashReadMode: 0 }, dataset, today)).toContain('двічі')
  expect(cashReadModeConfigurationError({ ...request(0), dataSource: 41 })).toContain('лише')
  expect(datasetConfigurationError({ ...defaultDatasetRequest(reportDatasets[0], '2026-09-01', '2026-09-30'), cashReadMode: 0 }, reportDatasets[0])).toContain('лише')
  expect(datasetConfigurationError({ ...defaultDatasetRequest(settlementModeDataset, '2026-09-01', '2026-09-30'), cashReadMode: 0 }, settlementModeDataset)).not.toBeNull()
  expect(cashPeriodConfigurationError(request(0), plain, today)).toContain('Сервер')
  expect(cashPeriodConfigurationError({ ...cashPeriodManagementRequest(), cashReadMode: 1 }, undefined, today)).toContain('кількома рахунками')
  expect(cashPeriodConfigurationError({ ...request(0), groupedCashPeriod: undefined }, dataset, today)).toContain('кількома рахунками')
})

it('opens new grouped requests on current documents and leaves single-account and older forms unmarked', () => {
  const current = defaultDatasetRequest(dataset, '2026-09-01', '2026-09-30')
  expect(current.cashReadMode).toBe(0)
  expect(datasetConfigurationError(current, dataset)).toBeNull()
  expect(datasetConfigurationError({ ...current, from: '2025-01-01', to: formatKyivBusinessDate() }, dataset)).toBeNull()
  expect(hasMode(defaultDatasetRequest(plain, '2026-09-01', '2026-09-30'))).toBe(false)
  expect(hasMode(withDefaultReadModes(cashPeriodManagementRequest(), dataset))).toBe(false)
})

it('applies current documents to a saved grouped request without a mode and reports the 01.01.2025 limit', () => {
  const saved = unmarked(dataset, '2024-12-01', '2024-12-31')
  expect(datasetConfigurationError(saved, dataset)).toBeNull()
  const current = withDefaultReadModes(saved, dataset)
  expect(current.cashReadMode).toBe(0)
  expect(saved).not.toHaveProperty('cashReadMode')
  expect(datasetConfigurationError(current, dataset)).toContain('120')
  expect(datasetConfigurationError({ ...current, cashReadMode: 1 }, dataset)).toContain('120')
  for (const mode of [0, 1, null]) {
    const explicit = { ...saved, CashReadMode: mode }
    expect(withDefaultReadModes(explicit, dataset)).toBe(explicit)
  }
  expect(withDefaultReadModes(saved, plain)).toBe(saved)
})

it.each([0, 1, null, undefined])('round trips mode %s through saved template, builder, retained fields, preset and draft', mode => {
  const original = unmarked(dataset, '2026-09-01', '2026-09-30')
  const normalized = normalizeSavedTemplate({ Id: 'stored', Revision: 1, UpdatedAtUtc: '2026-10-13T00:00:00Z', Name: 'saved', Data: {
    DataSource: 40, From: original.from, To: original.to, Sorted: original.sorted, Selections: [],
    GroupedCashPeriod: original.groupedCashPeriod, ...(mode !== undefined ? { CashReadMode: mode } : {}) } })
  expect(hasMode(normalized.Data)).toBe(mode !== undefined)
  expect(requestCashReadMode(normalized.Data)).toBe(mode)
  expect(requestCashReadMode(withDefaultReadModes(normalized.Data, dataset))).toBe(mode === undefined ? 0 : mode)
  expect(datasetConfigurationError(normalized.Data, dataset)).toBeNull()
  const data = buildReportBuilderRequest({ dataSource: 40, from: original.from, to: original.to,
    groupedCashPeriod: original.groupedCashPeriod, cashReadMode: requestCashReadMode(normalized.Data),
    ordering: undefined, filterExpression: undefined, topGroups: undefined, valuationClientAgreementId: undefined,
    rowGroups: original.sorted.Row, colGroups: [], measurements: datasetMeasurements(dataset, original.sorted.Measurements), selections: [] })
  expect(hasMode(data)).toBe(mode !== undefined)
  if (mode === undefined) expect(data).toEqual(original)
  expect(requestCashReadMode(retainStoredTemplateFields(normalized.Data, data))).toBe(mode)
  expect(retainStoredTemplateFields(normalized.Data, original)).not.toHaveProperty('CashReadMode')
  const preset = datasetPresetRequest(dataset, 'native-cash-period-account-currency', data)
  expect(preset).not.toBeNull()
  expect(hasMode(preset!.Data)).toBe(mode !== undefined)
  expect(requestCashReadMode(preset!.Data)).toBe(mode)
  const snapshot = { name: 'saved', data, measurements: datasetMeasurements(dataset, data.sorted.Measurements),
    activeTemplate: null, previousPeriod: { from: data.from, to: data.to } }
  expect(reportWorkspaceDraftCompatibility(snapshot, dataset)).toBeNull()
  expect(reportWorkspaceDraftCompatibility(snapshot, plain)).toBe(mode == null ? null
    : 'Сервер не підтвердив вибір джерела розрахунку коштів. Чернетка збережена без змін.')
})

it.each([dataset, { ...groupedCashWorkbookDataset, cashReadMode: capability }, { ...groupedCashDataset, cashReadMode: capability }])(
  'opens the cash workbook launch on current documents and mentions the source only with the capability', capable => {
    const { cashReadMode: _mode, ...previousDataset } = capable
    void _mode
    const launch = cashLaunch([capable])
    const previous = cashLaunch([previousDataset])
    expect(launch.notice).toBe(`${previous.notice} ${CASH_READ_MODE_NOTICE}`)
    expect(CASH_READ_MODE_NOTICE).toContain('Форма відкривається з джерелом «Поточні документи GBA»')
    expect(previous.notice).not.toContain('джерел')
    const day = previousKyivDay(formatKyivBusinessDate())
    const opened = bug1274WorkbookRequest(defaultDatasetRequest(capable, day, day), launch)
    expect(opened.cashReadMode).toBe(0)
    const legacy = bug1274WorkbookRequest(defaultDatasetRequest(previousDataset, day, day), previous)
    expect(hasMode(legacy)).toBe(false)
    expect(opened).toEqual({ ...legacy, cashReadMode: 0 })
    expect(datasetConfigurationError(opened, capable)).toBeNull()
    expect(datasetConfigurationError({ ...opened, from: '2025-01-01', to: formatKyivBusinessDate() }, capable)).toBeNull()
    expect(datasetConfigurationError({ ...opened, from: '2024-12-31' }, capable)).toContain('120')
    const unopted = bug1274WorkbookRequest(unmarked(capable, day, day), launch)
    expect(hasMode(unopted)).toBe(false)
    expect(datasetConfigurationError({ ...unopted, from: '2025-01-01' }, capable)).toContain('31')
  })
