import type { ReportDataset, ReportRequestBody } from '../types'
import { datasetGroupings } from './reportDatasets'

export const CUSTOMER_RETURN_WORKBOOK = 'Звіт повернення.xls'
export const CUSTOMER_RETURN_FILTERS = [6, 1, 2, 21, 64] as const
export function supportsCustomerReturnReport(dataset: ReportDataset): boolean {
  return dataset.DataSource === 2 && dataset.returnsOnly === true && dataset.customerReturnFilters === true
    && CUSTOMER_RETURN_FILTERS.every(type => dataset.Filters.some(field => field.Type === type && field.Selectable !== false))
}
export function customerReturnRequest(request: ReportRequestBody, dataset: ReportDataset): ReportRequestBody {
  const groups = datasetGroupings(dataset)
  const quantity = dataset.Measurements.find(item => item.Type === 0)
  return { dataSource: 2, returnsOnly: true, from: request.from, to: request.to, selections: [],
    sorted: { Row: [12, 5, 3].flatMap(type => groups.filter(item => item.type === type)), Col: [],
      Measurements: quantity ? [{ Type: 0, Name: quantity.Name, parentName: quantity.Name, IsChecked: true }] : [] } }
}
