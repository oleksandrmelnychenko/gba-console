import { analysisDataset } from './currentVparivanieAnalysis.test-fixtures'
import { upgradeCurrentVparivanieAnalysis } from './currentVparivanieAnalysis'
import { movementDataset } from './currentVparivanieMovements.test-fixtures'
import { describe, expect, it } from 'vitest'
import type { ReportDataset } from '../types'
import { defaultDatasetRequest, datasetMeasurements } from './reportDatasets'
import { reportDatasets, valuationDataset } from './reportDatasets.test-fixtures'
import { getNativeReportProfile } from './nativeReportProfiles'
import type { ReportWorkspaceSnapshot } from './reportWorkspaceDraft'
import { reportWorkspaceDraftCompatibility } from './reportWorkspaceDraftCompatibility'
import { documentDataset, documentRequest } from './currentFinancialDocumentAxes.test-fixtures'
import { currentFinancialDataset, currentFinancialRequest } from './currentFinancialAxes.test-fixtures'
import { productTimeDataset, productTimeRequest } from './currentFinancialProductTimeAxes.test-fixtures'
import { financialDataset } from './financialAxes.test-fixtures'

function snapshot(dataset: ReportDataset = reportDatasets[0]): ReportWorkspaceSnapshot {
  const data = defaultDatasetRequest(dataset, '', '')
  return { name: 'Незавершений звіт', data, measurements: datasetMeasurements(dataset, data.sorted.Measurements),
    activeTemplate: null, previousPeriod: { from: '', to: '2026-09-07' } }
}
function fixedDataset(source: number): ReportDataset {
  return { ...reportDatasets[0], DataSource: source, PeriodSupported: source !== 19,
    Groupings: getNativeReportProfile(source)!.rowGroupings.map(Type => ({ Type, Name: String(Type) })) }
}

describe('lossless draft editor compatibility', () => {
  it('allows unfinished dates, axes, measures, filters and advanced input without making the report valid', () => {
    const value = snapshot()
    value.data.sorted = { Row: [], Col: [], Measurements: [] }
    value.measurements = []
    value.data.selections = [{ IsChecked: true, SelectedField: { Name: '', Type: 0 }, FilterCondition: { Name: 'Дорівнює', Type: 0 }, Values: [] }]
    value.data.threshold = { Version: 1, Percent: '', unknown: { enabled: false, limit: null } }
    const before = structuredClone(value)
    expect(reportWorkspaceDraftCompatibility(value, reportDatasets[0])).toBeNull()
    expect(value).toEqual(before)
  })

  it('preserves exact valuation agreement identity while rejecting dates hidden by a current-state dataset', () => {
    const value = snapshot(valuationDataset)
    value.data.valuationClientAgreementId = 9000000001
    expect(reportWorkspaceDraftCompatibility(value, valuationDataset)).toBeNull()
    value.data.from = '2026-09-01'
    expect(reportWorkspaceDraftCompatibility(value, valuationDataset)).toMatch(/період/)
    expect(value.data.valuationClientAgreementId).toBe(9000000001)
    expect(value.data.from).toBe('2026-09-01')
  })

  it('rejects unavailable selected fields without deleting them, but keeps inactive measurement metadata', () => {
    const value = snapshot()
    value.measurements.push({ Name: 'future', IsChecked: false, SubList: [{ Type: 9000, Name: 'Майбутній показник', IsChecked: false }] })
    expect(reportWorkspaceDraftCompatibility(value, reportDatasets[0])).toBeNull()
    value.measurements.at(-1)!.SubList[0].IsChecked = true
    expect(reportWorkspaceDraftCompatibility(value, reportDatasets[0])).toMatch(/Склад полів/)
    expect(value.measurements.at(-1)!.SubList[0].Type).toBe(9000)
    value.measurements.at(-1)!.SubList[0].IsChecked = false
    value.data.sorted.Measurements.push({ Type: 9000, Name: 'Прихований показник', IsChecked: false, parentName: 'future' })
    expect(reportWorkspaceDraftCompatibility(value, reportDatasets[0])).toMatch(/Склад полів/)
    expect(value.data.sorted.Measurements.at(-1)!.Type).toBe(9000)
    value.data.sorted.Measurements.pop()
    value.data.sorted.Row.push({ type: 9001, key: 'future', label: 'Майбутня вісь' })
    expect(reportWorkspaceDraftCompatibility(value, reportDatasets[0])).toMatch(/Склад полів/)
    expect(reportWorkspaceDraftCompatibility(value)).toMatch(/недоступний/)
  })

  it('permits empty editable rows on source 13 but refuses a hidden column axis', () => {
    const dataset = { ...reportDatasets[0], DataSource: 13 }
    const value = snapshot()
    value.data.dataSource = 13
    value.data.sorted.Row = []
    expect(reportWorkspaceDraftCompatibility(value, dataset)).toBeNull()
    value.data.sorted.Col = [{ type: dataset.Groupings[0].Type, key: 'known', label: 'Відоме поле' }]
    expect(reportWorkspaceDraftCompatibility(value, dataset)).toMatch(/Структура/)
  })

  it('requires fixed axis order and refuses filters hidden by the rate dataset', () => {
    const dataset = fixedDataset(15)
    const value = snapshot(dataset)
    value.data.sorted.Measurements = []; value.measurements = []
    expect(reportWorkspaceDraftCompatibility(value, dataset)).toBeNull()
    value.data.sorted.Row.reverse()
    expect(reportWorkspaceDraftCompatibility(value, dataset)).toMatch(/Структура/)
    const rates = fixedDataset(19), rateDraft = snapshot(rates)
    rateDraft.data.sorted.Measurements = []; rateDraft.measurements = []
    rateDraft.data.selections = [{ IsChecked: false, SelectedField: { Name: '', Type: 0 }, FilterCondition: { Name: '', Type: 0 }, Values: [] }]
    expect(reportWorkspaceDraftCompatibility(rateDraft, rates)).toMatch(/Структура/)
    expect(rateDraft.data.selections).toHaveLength(1)
  })

  it('retains ambiguous aliases instead of choosing one and silently removing its error', () => {
    const value = snapshot()
    value.data.ordering = { Version: 1 }
    value.data.Ordering = { Version: 999 }
    expect(reportWorkspaceDraftCompatibility(value, reportDatasets[0])).toMatch(/неоднозначні/)
    expect(value.data).toMatchObject({ ordering: { Version: 1 }, Ordering: { Version: 999 } })
  })
})


it('restores unfinished movement drafts with automatic complete scope while refusing unavailable capabilities and ambiguous aliases', () => {
  const value = snapshot(movementDataset)
  value.data.currentVparivanieMovements = { Incoming: true, Outgoing: false }
  const before = structuredClone(value)
  expect(reportWorkspaceDraftCompatibility(value, movementDataset)).toBeNull()
  expect(value).toEqual(before)
  const capability = { ...movementDataset.currentVparivanie } as Record<string, unknown>
  delete capability.FullScopeVersion
  expect(reportWorkspaceDraftCompatibility(value, { ...movementDataset, currentVparivanie: capability })).toMatch(/не підтримує/)
  value.data.CurrentVparivanieMovements = { Incoming: true, Outgoing: false }
  expect(reportWorkspaceDraftCompatibility(value, movementDataset)).toMatch(/Некоректний/)
  delete value.data.CurrentVparivanieMovements
  value.data.currentVparivanieFullScope = false
  expect(reportWorkspaceDraftCompatibility(value, movementDataset)).toMatch(/має бути явно увімкнений/)
})

it('restores analysis39 article/product axes while keeping its own configurable layout validation', () => {
  const value = snapshot(analysisDataset)
  value.data = upgradeCurrentVparivanieAnalysis(value.data, analysisDataset)
  expect(value.data.sorted.Row.map(row => row.type)).toEqual([6, 5])
  expect(reportWorkspaceDraftCompatibility(value, analysisDataset)).toBeNull()
  value.data.sorted.Col = []
  expect(reportWorkspaceDraftCompatibility(value, analysisDataset)).not.toBeNull()
})

describe('financial capability fields in saved drafts', () => {
  const financialSnapshot = (dataset: ReportDataset, data: ReportWorkspaceSnapshot['data']): ReportWorkspaceSnapshot => ({
    ...snapshot(dataset), data, measurements: datasetMeasurements(dataset, data.sorted.Measurements),
  })

  it.each([12, 15])('admits client capability field %s without widening base metadata', type => {
    const value = financialSnapshot(currentFinancialDataset, currentFinancialRequest([type], [3]))
    const before = structuredClone(value)
    expect(reportWorkspaceDraftCompatibility(value, currentFinancialDataset)).toBeNull()
    expect(currentFinancialDataset.Groupings.map(field => field.Type)).toEqual([3, 4])
    expect(value).toEqual(before)
  })

  it.each([0, 1, 2, 5, 12, 15])('admits product/time capability field %s in either axis', type => {
    for (const [rows, columns] of [[[type], [3]], [[3], [type]]]) {
      const value = financialSnapshot(productTimeDataset, productTimeRequest(rows, columns))
      const before = structuredClone(value)
      expect(reportWorkspaceDraftCompatibility(value, productTimeDataset)).toBeNull()
      expect(value).toEqual(before)
    }
  })

  it.each([[[81], [5]], [[5], [81]], [[81, 15], []]])('admits document draft %j / %j with retained presentation and exact negative filter', (rows, columns) => {
    const value = financialSnapshot(documentDataset, { ...documentRequest(rows, columns),
      workbookPresentation: { version: 1, additionalFields: [2, 3], ordering: 'MonthAscending' } })
    const before = structuredClone(value)
    expect(reportWorkspaceDraftCompatibility(value, documentDataset)).toBeNull()
    expect(value).toEqual(before)
  })

  it.each([currentFinancialRequest([12], [3]), productTimeRequest([5], [3]), documentRequest([81], [5])])('retains but refuses a capability-only draft with old metadata', data => {
    const value = financialSnapshot(documentDataset, data)
    const before = structuredClone(value)
    expect(reportWorkspaceDraftCompatibility(value, financialDataset)).not.toBeNull()
    expect(value).toEqual(before)
  })

  it.each([1, 2])('refuses current financial fields in mode %s without dropping them', mode => {
    const value = financialSnapshot(documentDataset, { ...documentRequest([81], [5]), profitReadMode: mode })
    const before = structuredClone(value)
    expect(reportWorkspaceDraftCompatibility(value, documentDataset)).toMatch(/лише|несумісн|не підтримує/)
    expect(value).toEqual(before)
  })
})
