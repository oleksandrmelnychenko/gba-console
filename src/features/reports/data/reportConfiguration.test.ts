import { supplierWarehouseAfterRowEdit } from './supplierBasis'
import { describe, expect, it, vi } from 'vitest'
import type { ReportDataset, ReportRequestBody } from '../types'
import { effectiveReportConfiguration, reportConfigurationError, reportAxesPolicy, type ReportConfiguration } from './reportConfiguration'
import { defaultDatasetRequest, datasetMeasurements } from './reportDatasets'
import { presentedCashDataset, presentedSettlementDataset } from './workbookPresentation.test-fixtures'
import { reportWorkspaceDraftCompatibility } from './reportWorkspaceDraftCompatibility'
const configuration: ReportConfiguration = { version: 1, axisMode: 'profitRows', allowedRows: [73, 78, 4, 21], allowedColumns: [], minimumRows: 1, maximumRows: 3, allowRowReorder: true, rowLayouts: [], columnLayouts: [[]], mutuallyExclusiveRows: [[73, 78]], period: { required: true, supported: true, maximumDays: 31, maximumMonths: null, minimumDate: null }, variants: [{ key: 'currentDocuments', allowedRows: [78, 4, 21], period: { required: true, supported: true, maximumDays: 62, maximumMonths: null, minimumDate: null } }] }
const dataset: ReportDataset = { DataSource: 38, Name: 'Прибуток', Description: '', Groupings: [], Measurements: [], Filters: [], Limitations: [], configuration }
const rows = (types: number[]) => types.map(type => ({ type, key: String(type), label: String(type) }))
const request = (types: number[]): ReportRequestBody => ({ dataSource: 38, profitReadMode: 0, supplierBasis: 0, from: '2026-09-01', to: '2026-10-21', selections: [], sorted: { Row: rows(types), Col: [], Measurements: [] } })
describe('server report configuration', () => {
  it('supports subsets and permutations without changing the calculation period or allowing a receipt warehouse in current mode', () => {
    for (const layout of [[21], [4, 21], [21, 78, 4]]) expect(reportConfigurationError(request(layout), dataset)).toBeNull()
    expect(reportConfigurationError(request([73]), dataset)).toMatch(/групування/)
    expect(reportConfigurationError(request([78, 78]), dataset)).toMatch(/групування/)
    expect(reportConfigurationError(request([]), dataset)).toMatch(/групування/)
    expect(reportConfigurationError(request([]), dataset, true)).toBeNull()
    expect(effectiveReportConfiguration(dataset, request([21]))?.period.maximumDays).toBe(62)
    expect(reportAxesPolicy(dataset, request([21]))).toMatchObject({ fixed: false, rowsOnly: true })
  })
  it('treats nullable variant replacements from .NET metadata as inherited values', () => {
    const value = { ...dataset, configuration: { ...configuration, variants: [{ key: 'currentDocuments', axisMode: null, allowedRows: [78, 4, 21], allowedColumns: null, rowLayouts: null, columnLayouts: null, minimumRows: null, maximumRows: null, maximumColumns: null, period: null, filters: null }] } }
    expect(effectiveReportConfiguration(value, request([21]))).toMatchObject({ axisMode: 'profitRows', maximumRows: 3, allowedColumns: [], period: configuration.period })
  })
  it('retains hidden warehouse semantics but allows an explicit warehouse choice after hiding it', () => {
    const hidden = supplierWarehouseAfterRowEdit(undefined, rows([73, 4, 21]), rows([4, 21]))
    expect(hidden).toBe(73)
    expect(supplierWarehouseAfterRowEdit(hidden, rows([4, 21]), rows([21, 4]))).toBe(73)
    expect(supplierWarehouseAfterRowEdit(hidden, rows([4, 21]), rows([78, 4, 21]))).toBe(78)
    expect(supplierWarehouseAfterRowEdit(undefined, rows([78, 4, 21]), rows([21]))).toBe(78)
  })
  it('selects operational sales and legacy Fenix settlement variants independently of row order', () => {
    const variants = [{ key: 'operational', allowedRows: [5] }, { key: 'originalNormal', period: { ...configuration.period, maximumDays: null, maximumMonths: 120 } }]
    const configured = { ...dataset, configuration: { ...configuration, variants } }
    expect(effectiveReportConfiguration(configured, { ...request([5]), dataSource: 27, priceTypeSalesComparison: { SalesBasis: 0 } })?.allowedRows).toEqual([5])
    const legacy = { ...request([4, 76]), dataSource: 41, profitReadMode: undefined, groupedSettlementPeriod: { SourceWorld: 'Fenix' }, sourceBuyerSubtree: {} }
    expect(effectiveReportConfiguration(configured, legacy)?.period.maximumMonths).toBe(120)
    expect(effectiveReportConfiguration(configured, { ...legacy, groupedSettlementPeriod: { SourceWorld: 'Amg' } })?.period.maximumDays).toBe(31)
  })
  it('enforces the server closing-day policy for imported requests, not only the date picker', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-21T12:00:00Z'))
    try {
      const configured = { ...dataset, configuration: { ...configuration, variants: [], period: { ...configuration.period, endDatePolicy: 'beforeKyivToday' } } }
      expect(reportConfigurationError({ ...request([21]), from: '2026-10-01', to: '2026-10-21' }, configured)).toMatch(/кінцеву дату/)
      expect(reportConfigurationError({ ...request([21]), from: '2026-10-01', to: '2026-10-20' }, configured)).toBeNull()
    } finally { vi.useRealTimers() }
  })
  it('keeps legacy special forms fixed until server confirms editable capability', () => {
    expect(reportAxesPolicy(undefined, { ...request([3, 4]), dataSource: 35 }).fixed).toBe(true)
    expect(reportAxesPolicy(undefined, { ...request([3, 4]), dataSource: 36 }).fixed).toBe(true)
  })
  it.each([[40, [40, 44, 43]], [41, [4, 41, 76]], [41, [4, 76]]] as const)('restores valid source%s draft axes without extra workbook presentation', (source, layout) => {
    const dataSet = source === 40 ? presentedCashDataset : presentedSettlementDataset
    const data = defaultDatasetRequest(dataSet, '2026-10-01', '2026-10-04')
    data.sorted.Row = rows([...layout])
    delete data.workbookPresentation
    const snapshot = { name: 'Збережений звіт', data, measurements: datasetMeasurements(dataSet, data.sorted.Measurements), activeTemplate: null, previousPeriod: { from: data.from, to: data.to } }
    expect(reportWorkspaceDraftCompatibility(snapshot, dataSet)).toBeNull()
    expect(snapshot.data.sorted.Row.map(row => row.type)).toEqual(layout)
  })
})
