import { expect, it } from 'vitest'
import { grossDataset, netDataset } from './reportDatasets.test-fixtures'
import { defaultDatasetRequest, datasetConfigurationError, datasetMeasurements, datasetFilters } from './reportDatasets'
import { availableBug1274WorkbookLaunches, bug1274WorkbookRequest } from './bug1274WorkbookLaunch'
import { cloneReportProfile, GROSS_PROFIT_CONSTRUCTOR_WORKBOOK, SALES_CONSTRUCTOR_WORKBOOK, salesConstructorDataset, salesConstructorError } from './salesConstructorProfiles'
import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { flattenCheckedMeasurements } from './reportOptions'

const dataset = { ...netDataset, reportProfiles: ['sales', 'grossProfit'], Groupings: grossDataset.Groupings }
it('opens two explicit profiles on GBA net sales without redirecting old saved managerial reports', () => {
  expect(availableBug1274WorkbookLaunches([netDataset])).toEqual([])
  const launches = availableBug1274WorkbookLaunches([dataset])
  expect(launches.map(item => item.fileName)).toEqual([SALES_CONSTRUCTOR_WORKBOOK, GROSS_PROFIT_CONSTRUCTOR_WORKBOOK])
  const base = defaultDatasetRequest(dataset, '2026-10-01', '2026-10-28')
  const sales = bug1274WorkbookRequest(base, launches[0]), profit = bug1274WorkbookRequest(base, launches[1])
  expect(sales).toMatchObject({ dataSource: 2, reportProfile: 'sales', selections: [] })
  expect(profit).toMatchObject({ dataSource: 2, reportProfile: 'grossProfit', selections: [] })
  expect(profit.sorted.Row.map(item => item.type)).toEqual([4, 10, 7])
  expect(profit.sorted.Col.map(item => item.type)).toEqual([2])
  expect(profit.sorted.Measurements.map(item => item.Type)).toEqual([2, 6, 10])
  expect(datasetConfigurationError(profit, dataset)).toBeNull()
  expect(profit).not.toHaveProperty('oneC')
  expect(profit).not.toHaveProperty('profitReadMode')
})
it('retains the profile and chosen indicator order through the server template wire and changed dates', () => {
  const launch = availableBug1274WorkbookLaunches([dataset])[1]
  const data = bug1274WorkbookRequest(defaultDatasetRequest(dataset, '2026-10-01', '2026-10-28'), launch)
  data.sorted.Measurements.push(...[14, 15].map(Type => ({ Type, Name: dataset.Measurements.find(field => field.Type === Type)!.Name,
    IsChecked: true, parentName: '' })))
  data.sorted.Measurements.reverse()
  const saved = normalizeSavedTemplate({ Id: 'profile-test', Revision: 1, UpdatedAtUtc: '2026-10-28T00:00:00Z', Name: 'Мій прибуток', Data: {
    DataSource: 2, From: data.from, To: data.to, Sorted: data.sorted, Selections: [], ReportProfile: 'grossProfit',
  } })
  const changed = { ...saved.Data, from: '2026-09-01', to: '2026-09-30' }
  expect(changed.reportProfile).toBe('grossProfit')
  expect(flattenCheckedMeasurements(datasetMeasurements(salesConstructorDataset(dataset, changed.reportProfile), changed.sorted.Measurements)).map(item => item.Type)).toEqual([15, 14, 10, 6, 2])
  expect(salesConstructorError(changed, dataset)).toBeNull()
})
it('refuses unknown or conflicting profiles, previous-server capabilities and unrelated resources', () => {
  const data = bug1274WorkbookRequest(defaultDatasetRequest(dataset, '', ''), availableBug1274WorkbookLaunches([dataset])[1])
  expect(salesConstructorError(data, netDataset)).toContain('ще не підтримує')
  expect(salesConstructorError({ ...data, dataSource: 43 }, dataset)).toContain('Невідомий')
  expect(salesConstructorError({ ...data, ...cloneReportProfile({ reportProfile: 'sales', ReportProfile: 'grossProfit' }) }, dataset)).toContain('Невідомий')
  expect(salesConstructorError({ ...data, sorted: { ...data.sorted, Measurements: [{ Type: 11, Name: 'MarkupVAT', IsChecked: true, parentName: '' }] } }, dataset)).toContain('Показник')
})

it('offers the advertised physical warehouse in both sales forms while hiding return-only reason', () => {
  const source = { ...dataset, Filters: [{ Type: 1, Name: 'Product' }, { Type: 21, Name: 'Warehouse' }, { Type: 64, Name: 'ReturnReason' }] }
  for (const profile of ['sales', 'grossProfit']) expect(salesConstructorDataset(source, profile)?.Filters.map(field => field.Type)).toEqual([1, 21])
})
it('offers the buyer price-type filter in both sales forms and accepts an active selection', () => {
  const withFilters = { ...dataset, Filters: [11, 21, 64, 0].map(Type => ({ Type, Name: String(Type), Selectable: true })) }
  for (const profile of ['sales', 'grossProfit'] as const) {
    expect(salesConstructorDataset(withFilters, profile)?.Filters.map(field => field.Type)).toEqual([11, 21, 0])
    const request = { ...defaultDatasetRequest(withFilters, '2026-10-01', '2026-10-31'), reportProfile: profile,
      selections: [{ IsChecked: true, SelectedField: { Type: 11, Name: 'Тип ціни' }, FilterCondition: { Type: 2, Name: 'У списку' }, Values: [{ Data: { Id: 849 }, Name: 'ЦО2', Value: 849 }] }] }
    request.sorted.Measurements = request.sorted.Measurements.filter(item => item.Type === 2)
    const saved = structuredClone(request)
    expect(salesConstructorError(request, withFilters)).toBeNull()
    expect(request).toEqual(saved)
  }
})

it('uses the same historical price-type rule for customer comparison and preserves other dataset filters', () => {
  const source = { ...dataset, DataSource: 44, Filters: [11, 21, 6].map(Type => ({ Type, Name: String(Type) })) }
  expect(datasetFilters(source).map(option => option.field.Type)).toEqual([21, 6])
  expect(datasetFilters({ ...source, DataSource: 39 }).map(option => option.field.Type)).toEqual([11, 21, 6])
  const request = { ...defaultDatasetRequest(source, '2026-10-01', '2026-10-31'),
    selections: [{ IsChecked: true, SelectedField: { Type: 11, Name: 'Тип ціни' }, FilterCondition: { Type: 2, Name: 'У списку' }, Values: [{ Data: { Id: 849 }, Name: 'ЦО2', Value: 849 }] }] }
  const saved = structuredClone(request)
  expect(datasetConfigurationError(request, source)).toContain('історичного типу документа')
  expect(request).toEqual(saved)
})

it('offers both advertised profitability measures in gross profit without exposing unrelated measures', () => {
  const filtered = salesConstructorDataset(dataset, 'grossProfit')!
  expect(filtered.Measurements.filter(field => [14, 15].includes(field.Type)))
    .toEqual(dataset.Measurements.filter(field => [14, 15].includes(field.Type)))
  expect(filtered.Measurements.some(field => field.Type === 11 || field.Type === 12)).toBe(false)
  const request = { ...defaultDatasetRequest(filtered, '2026-10-01', '2026-10-31'), reportProfile: 'grossProfit',
    sorted: { Row: [{ type: 4, key: 'Organization', label: 'Організація' }], Col: [],
      Measurements: [15, 14].map(Type => ({ Type, Name: dataset.Measurements.find(field => field.Type === Type)!.Name,
        IsChecked: true, parentName: '' })) } }
  expect(salesConstructorError(request, dataset)).toBeNull()
  expect(datasetConfigurationError(request, dataset)).toBeNull()
})

it('does not invent profitability choices absent or unselectable in server metadata', () => {
  const restricted = { ...dataset, Measurements: dataset.Measurements.filter(field => field.Type !== 14)
    .map(field => field.Type === 15 ? { ...field, Selectable: false } : field) }
  const choices = datasetMeasurements(salesConstructorDataset(restricted, 'grossProfit')).flatMap(group => group.SubList)
  expect(choices.some(field => field.Type === 14 || field.Type === 15)).toBe(false)
})
