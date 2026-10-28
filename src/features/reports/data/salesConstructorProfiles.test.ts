import { expect, it } from 'vitest'
import { grossDataset, netDataset } from './reportDatasets.test-fixtures'
import { defaultDatasetRequest, datasetConfigurationError, datasetMeasurements } from './reportDatasets'
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
  data.sorted.Measurements.reverse()
  const saved = normalizeSavedTemplate({ Id: 'profile-test', Revision: 1, UpdatedAtUtc: '2026-10-28T00:00:00Z', Name: 'Мій прибуток', Data: {
    DataSource: 2, From: data.from, To: data.to, Sorted: data.sorted, Selections: [], ReportProfile: 'grossProfit',
  } })
  const changed = { ...saved.Data, from: '2026-09-01', to: '2026-09-30' }
  expect(changed.reportProfile).toBe('grossProfit')
  expect(flattenCheckedMeasurements(datasetMeasurements(salesConstructorDataset(dataset, changed.reportProfile), changed.sorted.Measurements)).map(item => item.Type)).toEqual([10, 6, 2])
  expect(salesConstructorError(changed, dataset)).toBeNull()
})
it('refuses unknown or conflicting profiles, previous-server capabilities and unrelated resources', () => {
  const data = bug1274WorkbookRequest(defaultDatasetRequest(dataset, '', ''), availableBug1274WorkbookLaunches([dataset])[1])
  expect(salesConstructorError(data, netDataset)).toContain('ще не підтримує')
  expect(salesConstructorError({ ...data, dataSource: 43 }, dataset)).toContain('Невідомий')
  expect(salesConstructorError({ ...data, ...cloneReportProfile({ reportProfile: 'sales', ReportProfile: 'grossProfit' }) }, dataset)).toContain('Невідомий')
  expect(salesConstructorError({ ...data, sorted: { ...data.sorted, Measurements: [{ Type: 14, Name: 'Profitability', IsChecked: true, parentName: '' }] } }, dataset)).toContain('Показник')
})

it('hides return-only warehouse and reason filters in both sales forms', () => {
  const source = { ...dataset, Filters: [{ Type: 1, Name: 'Product' }, { Type: 21, Name: 'Warehouse' }, { Type: 64, Name: 'ReturnReason' }] }
  for (const profile of ['sales', 'grossProfit']) expect(salesConstructorDataset(source, profile)?.Filters.map(field => field.Type)).toEqual([1])
})
