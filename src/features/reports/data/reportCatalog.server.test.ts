import { describe, expect, it } from 'vitest'
import fixture from './reportCatalog.server-fixture.json'
import { parseReportDatasets } from '../api/reportWorkspaceApi'
import { validateStockReportRequest } from '../api/reportsApi'
import { cashPeriodConfigurationError } from './cashPeriod'
import { customerReturnRequest } from './customerReturnReport'
import { groupCanonicalFilterOptions } from './reportFilterFields'
import { datasetConfigurationError, datasetFilters, defaultDatasetRequest } from './reportDatasets'
import { effectiveReportConfiguration } from './reportConfiguration'
import { readFilterExpressionCapabilities } from './reportFilterExpression'
import type { ReportDataset, ReportRequestBody, ReportSelection } from '../types'

const ACTIVE = [2, 3, 35, 38, 39, 40, 41, 43, 44, 45, 46]
const datasets = parseReportDatasets(fixture)

function value(source: number, field: number): unknown {
  if (field === 3) return source === 46 ? { Id: 'A' } : { Name: 'A' }
  if (source === 35 && field === 12) return { kind: 'sale', id: '1' }
  if ((source === 35 || source === 39) && field === 60) return { Id: '33221100554477668899AABBCCDDEEFF' }
  if (source === 46 || source === 44) return { Id: '1' }
  return { Id: 1 }
}

function selection(source: number, field: { Type: number; Name: string }, condition = source === 39 && field.Type === 4 ? 6 : 0): ReportSelection {
  return { IsChecked: true, SelectedField: field, FilterCondition: { Type: condition, Name: 'Рівне' },
    Values: [{ Data: value(source, field.Type) as ReportSelection['Values'][number]['Data'], Name: 'x', Value: 0 }] }
}

function base(dataset: ReportDataset): ReportRequestBody {
  const request = defaultDatasetRequest(dataset, '2026-10-01', '2026-10-15')
  if (dataset.DataSource !== 39) return request
  const product = datasetFilters(dataset, request).find(option => option.field.Type === 1)!
  return { ...request, selections: [selection(39, product.field)] }
}

function offered(dataset: ReportDataset, request: ReportRequestBody) {
  const allowed = effectiveReportConfiguration(dataset, request)?.filters
  return datasetFilters(dataset, request).filter(option => !allowed || allowed.includes(option.field.Type))
}

describe('the current server report catalog', () => {
  it('parses every active dataset the server publishes', () => {
    expect(datasets.map(dataset => dataset.DataSource).sort((a, b) => a - b)).toEqual([...ACTIVE].sort((a, b) => a - b))
    for (const source of ACTIVE) expect(datasets.some(dataset => dataset.DataSource === source), `source ${source}`).toBe(true)
  })

  it.each(ACTIVE)('source %i accepts its default request and every offered filter field', source => {
    const dataset = datasets.find(item => item.DataSource === source)!
    const request = base(dataset)
    expect(datasetConfigurationError(request, dataset)).toBeNull()
    for (const option of offered(dataset, request)) {
      if (source === 39 && option.field.Type === 1) continue
      const filtered = { ...request, selections: [...request.selections, selection(source, option.field)] }
      expect(datasetConfigurationError(filtered, dataset), `source ${source} field ${option.field.Type}`).toBeNull()
    }
  })

  it.each(ACTIVE)('source %i accepts an І/АБО tree when the server offers it', source => {
    const dataset = datasets.find(item => item.DataSource === source)!
    expect(readFilterExpressionCapabilities(dataset), `source ${source}`).not.toBeNull()
    const request = base(dataset)
    const fields = offered(dataset, request).filter(option => !request.selections.some(item => item.SelectedField.Type === option.field.Type))
      .filter(option => source !== 39 || option.field.Type === 4).slice(0, 2)
    const selections = [...request.selections, ...fields.map(option => selection(source, option.field))]
    const leaves = selections.map((_, SelectionIndex) => ({ Kind: 3 as const, SelectionIndex }))
    const root = source === 39 ? { Kind: 1 as const, Children: [leaves[0], { Kind: 2 as const, Children: leaves.slice(1) }] } : { Kind: 2 as const, Children: leaves }
    const tree = { ...request, selections, filterExpression: { Version: 1, Root: root } }
    expect(datasetConfigurationError(tree, dataset), `source ${source}`).toBeNull()
  })
})

describe('catalog resilience', () => {
  it('keeps the other reports when one dataset carries an unknown field', () => {
    for (const source of ACTIVE) {
      const changed = (fixture as Array<Record<string, unknown>>).map(item => item.DataSource === source
        ? { ...item, Filters: [...(item.Filters as unknown[]), { Type: 99, Name: 'Нове поле' }] }
        : item)
      const parsed = parseReportDatasets(changed)
      expect(parsed.filter(item => item.DataSource !== source).map(item => item.DataSource))
        .toEqual(datasets.filter(item => item.DataSource !== source).map(item => item.DataSource))
    }
  })
})

describe('cash statement forms', () => {
  it('builds «Рахунок / Тип / Організація» with no filters and the default indicators', () => {
    const dataset = datasets.find(item => item.DataSource === 40)!
    const request = defaultDatasetRequest(dataset, '2026-10-01', '2026-10-15')
    request.sorted.Row = [40, 44, 43].map(type => dataset.Groupings.find(row => row.Type === type)!).map(row => ({ type: row.Type, key: String(row.Type), label: row.Name }))
    expect(datasetConfigurationError(request, dataset)).toBeNull()
    expect(() => validateStockReportRequest(request, dataset)).not.toThrow()
    expect(cashPeriodConfigurationError(request, undefined, '2026-11-16')).toBeNull()
  })
})

describe('filter field list names', () => {
  it('names every group and field once in each report, «Звіт повернення» included', () => {
    const returns = datasets.find(item => item.DataSource === 2)!
    const requests = [...ACTIVE.map(source => base(datasets.find(item => item.DataSource === source)!)),
      customerReturnRequest(defaultDatasetRequest(returns, '2026-10-01', '2026-10-15'), returns)]
    for (const request of requests) {
      const dataset = datasets.find(item => item.DataSource === request.dataSource)!
      const grouped = groupCanonicalFilterOptions(request.dataSource, offered(dataset, request))
      const names = grouped.flatMap(entry => 'group' in entry ? [entry.group, ...entry.items.map(item => item.label)] : [entry.label])
      expect(names.filter((name, index) => names.indexOf(name) !== index), `source ${request.dataSource}`).toEqual([])
    }
  })
})
