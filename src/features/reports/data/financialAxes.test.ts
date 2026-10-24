import { describe, expect, it } from 'vitest'
import { financialAxesCapability, validFinancialAxes } from './financialAxes'
import { axisFields, financialAxes, financialDataset, financialSourceFilters } from './financialAxes.test-fixtures'
import { datasetConfigurationError, defaultDatasetRequest } from './reportDatasets'
import { reportAxesPolicy, reportConfigurationError } from './reportConfiguration'
import { dayOrganizationGrossProfitConfigurationError } from './dayOrganizationGrossProfit'
import { parseReportDatasets } from '../api/reportWorkspaceApi'

const request = (rows = [3], cols = [4]) => {
  const data = defaultDatasetRequest(financialDataset, '2026-10-17', '2026-10-17')
  return { ...data, profitReadMode: 0, sorted: { ...data.sorted, Row: axisFields(rows), Col: axisFields(cols) } }
}
describe('explicit financial axes capability', () => {
  it('retains exact capability through metadata parsing and keeps absent capability row-only', () => {
    expect(parseReportDatasets([financialDataset])[0].financialAxes).toEqual(financialAxes)
    expect(reportAxesPolicy(financialDataset, request())).toMatchObject({ rowsOnly: false, fixed: false })
    const legacy = { ...financialDataset, financialAxes: undefined, configuration: { ...financialDataset.configuration as object, allowedColumns: [], maximumColumns: 0 } }
    expect(parseReportDatasets([legacy])[0].financialAxes).toBeUndefined()
    expect(datasetConfigurationError(request([3, 4], []), legacy)).toBeNull()
    expect(reportAxesPolicy(legacy, request())).toMatchObject({ rowsOnly: true })
    expect(dayOrganizationGrossProfitConfigurationError(request(), legacy)).not.toBeNull()
    expect(dayOrganizationGrossProfitConfigurationError(request(), undefined)).not.toBeNull()
  })
  it.each([null, {}, { ...financialAxes, version: 2 }, { ...financialAxes, maximumColumns: 2 },
    { ...financialAxes, maximumOutputColumns: 257 }, { ...financialAxes, uniqueAcrossAxes: false },
    { ...financialAxes, allowedColumns: [4, 3] }])('rejects unsupported metadata %j', capability => {
    const dataset = { ...financialDataset, financialAxes: capability }
    expect(financialAxesCapability(dataset)).toBeUndefined()
    expect(() => parseReportDatasets([dataset])).toThrow('наборів')
  })
  it('does not enable columns for another financial source', () => {
    expect(financialAxesCapability({ ...financialDataset, DataSource: 38 })).toBeUndefined()
    expect(() => parseReportDatasets([{ ...financialDataset, DataSource: 38 }])).toThrow()
  })
  it.each([[[3], [4]], [[4], [3]], [[3, 4], []], [[4, 3], []], [[3], []], [[4], []]])('accepts rows %j columns %j', (rows, cols) => {
    const data = request(rows, cols)
    expect(validFinancialAxes(data)).toBe(true)
    expect(reportConfigurationError(data, financialDataset)).toBeNull()
    expect(datasetConfigurationError(data, financialDataset)).toBeNull()
  })
  it.each([[[], [3]], [[3], [3]], [[3, 4], [4]], [[3], [4, 4]], [[3, 3], []], [[21], [4]], [[3], [21]]])('rejects rows %j columns %j without rewriting them', (rows, cols) => {
    const data = request(rows, cols), before = structuredClone(data)
    expect(validFinancialAxes(data)).toBe(false)
    expect(datasetConfigurationError(data, financialDataset)).not.toBeNull()
    expect(data).toEqual(before)
  })
  it('preserves mode, source selections, dates and signed one-day restriction for both orientations', () => {
    for (const [rows, cols] of [[[3], [4]], [[4], [3]]]) {
      const normal = { ...request(rows, cols), ...financialSourceFilters, profitReadMode: 1, dayOrganizationBasis: 0 }
      const legacyNormal = { ...normal, profitReadMode: undefined }
      const signed = { ...normal, profitReadMode: undefined, dayOrganizationBasis: 1 }
      for (const data of [normal, legacyNormal, signed]) {
        const before = structuredClone(data)
        expect(datasetConfigurationError(data, financialDataset)).toBeNull()
        expect(data).toEqual(before)
      }
      expect(datasetConfigurationError({ ...signed, to: '2026-10-18' }, financialDataset)).not.toBeNull()
      expect(datasetConfigurationError({ ...request(rows, cols), to: '2026-12-01' }, financialDataset)).not.toBeNull()
    }
  })
})
