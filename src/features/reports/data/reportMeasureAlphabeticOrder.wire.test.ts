import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createStockReport } from '../api/reportsApi'
import { saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { alphabetizeMeasurements, reorderMeasurementItem } from './reportConstructorTree'
import { datasetMeasurements, defaultDatasetRequest } from './reportDatasets'
import { flattenCheckedMeasurements } from './reportOptions'
import { supplierProfileDataset as dataset } from './salesProfileSupplier.test-fixtures'
import type { ReportMeasurementGroup } from '../types'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

it('serializes sorted selected order through real template save/restore and generation adapters without changing settings', async () => {
  const groups: ReportMeasurementGroup[] = [
    { Name: 'Cost', Label: 'Собівартість', IsChecked: true, SubList: [
      { Name: 'CostWithVAT', Label: 'З ПДВ', Type: 4, IsChecked: true },
      { Name: 'CostWithoutVAT', Label: 'Без ПДВ', Type: 6, IsChecked: true },
      { Name: 'CostVAT', Label: 'ПДВ', Type: 5, IsChecked: false }] },
    { Name: 'SalesQuantity', Label: 'Кількість', IsChecked: true, SubList: [
      { Name: 'SalesQuantity', Label: 'Кількість', Type: 0, IsChecked: true }] },
  ]
  const ordered = alphabetizeMeasurements(groups, 1, group => group.Label!, item => item.Label!)
  expect(flattenCheckedMeasurements(ordered).map(item => item.Type)).toEqual([0, 6, 4])
  const manual = reorderMeasurementItem(ordered, 4, -1)
  const data = { ...defaultDatasetRequest(dataset, '2026-10-18', '2026-10-27'), reportProfile: 'sales',
    sorted: { Row: [{ type: 7, key: 'ProductName', label: 'Товар' }], Col: [], Measurements: flattenCheckedMeasurements(manual) },
    selections: [{ IsChecked: true, SelectedField: { Type: 1, Name: 'Товар' }, FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [{ Name: 'Товар', Value: 0, Data: { Id: 123 } }] }] }
  const original = structuredClone(data)
  vi.mocked(apiRequest).mockResolvedValueOnce({ Id: 'ordered', Revision: 1, UpdatedAtUtc: '2026-10-29T00:00:00Z', Name: 'Порядок',
    Data: { DataSource: data.dataSource, From: data.from, To: data.to, ReportProfile: data.reportProfile, Sorted: data.sorted, Selections: data.selections } })
  const saved = await saveServerReportTemplate({ Id: 'ordered', Name: 'Порядок', Data: data }, undefined, dataset)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/templates/save', expect.objectContaining({ body: expect.objectContaining({ Data: data }) }))
  expect(saved.Data.sorted.Measurements.map(item => item.Type)).toEqual([0, 4, 6])
  expect(flattenCheckedMeasurements(datasetMeasurements(dataset, saved.Data.sorted.Measurements)).map(item => item.Type)).toEqual([0, 4, 6])
  vi.mocked(apiRequest).mockResolvedValueOnce({ DocumentURL: '/files/report.xlsx' })
  await createStockReport(saved.Data, dataset)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/stocks/generate', expect.objectContaining({ body: expect.objectContaining({
    from: data.from, to: data.to, reportProfile: 'sales', selections: data.selections,
    sorted: expect.objectContaining({ Row: data.sorted.Row, Col: [], Measurements: saved.Data.sorted.Measurements }),
  }) }))
  expect(data).toEqual(original)
})
