import { describe, expect, it } from 'vitest'
import type { ReportDataset } from '../types'
import { defaultDatasetRequest, datasetMeasurements } from './reportDatasets'
import { reportDatasets, valuationDataset } from './reportDatasets.test-fixtures'
import { getNativeReportProfile } from './nativeReportProfiles'
import type { ReportWorkspaceSnapshot } from './reportWorkspaceDraft'
import { reportWorkspaceDraftCompatibility } from './reportWorkspaceDraftCompatibility'

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
