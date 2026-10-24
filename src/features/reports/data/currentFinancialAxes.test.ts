import { describe, expect, it } from 'vitest'
import { currentFinancialAxesCapability } from './currentFinancialAxes'
import { currentFinancialAxes, currentFinancialDataset, currentFinancialRequest } from './currentFinancialAxes.test-fixtures'
import { financialDataset, financialSourceFilters } from './financialAxes.test-fixtures'
import { datasetConfigurationError, datasetGroupings } from './reportDatasets'
import { reportAxesPolicy } from './reportConfiguration'
import { parseReportDatasets, normalizeSavedTemplate } from '../api/reportWorkspaceApi'

describe('CurrentDocuments client/agreement axes capability', () => {
  it('adds capability without changing the legacy grouping catalog, and requires explicit mode and basis', () => {
    const parsed = parseReportDatasets([currentFinancialDataset])[0]
    expect(parsed.Groupings).toEqual(financialDataset.Groupings)
    expect(parsed.financialAxes).toEqual(financialDataset.financialAxes)
    expect(parsed.currentFinancialAxes).toEqual(currentFinancialAxes)
    expect(datasetGroupings(parsed).map(f => f.type)).toEqual([3, 4])
    expect(datasetGroupings(parsed, currentFinancialRequest()).map(f => f.type)).toEqual([3, 4, 12, 15])
    expect(reportAxesPolicy(parsed, currentFinancialRequest()).config).toMatchObject({ allowedRows: [3, 4, 12, 15], maximumTotalDimensions: 2 })
    for (const profitReadMode of [undefined, null, 1]) {
      const data = { ...currentFinancialRequest(), profitReadMode }
      expect(datasetGroupings(parsed, data).map(f => f.type)).toEqual([3, 4])
      expect(datasetConfigurationError(data, parsed)).toContain('Поточних документів GBA')
    }
  })
  it.each([null, {}, { ...currentFinancialAxes, version: 2 }, { ...currentFinancialAxes, maximumTotalDimensions: 3 },
    { ...currentFinancialAxes, maximumColumns: 2 }, { ...currentFinancialAxes, requiredProfitReadMode: 1 },
    { ...currentFinancialAxes, requiredDayOrganizationBasis: 1 }, { ...currentFinancialAxes, allowedRows: [3, 4, 6, 9] },
    { ...currentFinancialAxes, groupings: [{ Type: 12, Name: '', Selectable: true }, currentFinancialAxes.groupings[1]] },
    { ...currentFinancialAxes, groupings: [{ Type: 12, Name: 'Клієнт', Selectable: false }, currentFinancialAxes.groupings[1]] },
  ])('rejects unsupported metadata %j', capability => {
    const dataset = { ...currentFinancialDataset, currentFinancialAxes: capability }
    expect(currentFinancialAxesCapability(dataset)).toBeUndefined()
    expect(() => parseReportDatasets([dataset])).toThrow()
  })
  const types = [3, 4, 12, 15]
  const layouts = types.flatMap(first => [[[first], []], ...types.filter(second => second !== first).flatMap(second => [[[first, second], []], [[first], [second]]])])
  it.each(layouts)('accepts advertised current axes %j / %j without rewriting the request', (rows, cols) => {
    const data = { ...currentFinancialRequest(rows, cols), ...financialSourceFilters }
    const before = structuredClone(data)
    expect(datasetConfigurationError(data, currentFinancialDataset)).toBeNull()
    expect(data).toEqual(before)
  })
  it.each([[[], [12]], [[12, 15], [3]], [[12], [15, 4]], [[12, 12], []], [[12], [12]], [[6], [15]]])('rejects invalid axes %j / %j without truncation', (rows, cols) => {
    const data = currentFinancialRequest(rows, cols), before = structuredClone(data)
    expect(datasetConfigurationError(data, currentFinancialDataset)).not.toBeNull()
    expect(data).toEqual(before)
  })
  it('keeps legacy, Normal, Signed and source38 unavailable for the new axes', () => {
    expect(datasetConfigurationError(currentFinancialRequest(), financialDataset)).toContain('Сервер'.toLowerCase())
    expect(currentFinancialAxesCapability({ ...currentFinancialDataset, DataSource: 38 })).toBeUndefined()
    for (const patch of [{ dayOrganizationBasis: 1 }, { dayOrganizationBasis: undefined }, { profitReadMode: null }, { profitReadMode: 1 }]) {
      const data = { ...currentFinancialRequest(), ...financialSourceFilters, ...patch }, before = structuredClone(data)
      expect(datasetConfigurationError(data, currentFinancialDataset)).toContain('групування')
      expect(data).toEqual(before)
    }
    const normal = { ...currentFinancialRequest([3], [4]), ...financialSourceFilters, profitReadMode: 1 }
    expect(datasetConfigurationError(normal, currentFinancialDataset)).toBeNull()
    expect(reportAxesPolicy(currentFinancialDataset, normal).config?.allowedRows).toEqual([3, 4])
  })
  it('retains saved axes, dates, selections and explicit mode; incompatible templates are rejected unchanged', () => {
    const data = currentFinancialRequest()
    const saved = normalizeSavedTemplate({ Id: '10000000-0000-4000-8000-000000000035', Revision: 1, Name: 'Клієнти', UpdatedAtUtc: '2026-10-25T00:00:00Z',
      Data: { DataSource: 35, From: data.from, To: data.to, Sorted: data.sorted, Selections: data.selections,
        ProfitReadMode: 0, DayOrganizationBasis: 0 } })
    expect(datasetConfigurationError(saved.Data, currentFinancialDataset)).toBeNull()
    expect(saved.Data.sorted).toEqual(data.sorted)
    expect(saved.Data.from).toBe(data.from)
    const incompatible = { ...saved.Data, profitReadMode: 1 }, before = structuredClone(incompatible)
    expect(datasetConfigurationError(incompatible, currentFinancialDataset)).toContain('Поточних документів GBA')
    expect(incompatible).toEqual(before)
  })
})
