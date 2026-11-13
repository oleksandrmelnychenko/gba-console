import type { ReportDataset, ReportOrdering, ReportRequestBody } from '../types'
import { accountBalanceDataset } from './accountBalances.test-fixtures'
import { datasetGroupings, defaultDatasetRequest } from './reportDatasets'
export const orderedAccountDataset: ReportDataset = { ...accountBalanceDataset, Ordering: { Version: 1, MaximumRules: 32,
  Groupings: accountBalanceDataset.Groupings.map(field => ({ Type: field.Type, By: [1, 2, 3] })) } }
export const accountOrdering: ReportOrdering = { Version: 1, Rows: [{ Grouping: 40, By: 3, Measure: 24, Direction: 2, Nulls: 2 }], Columns: [] }
export function orderedAccountRequest(): ReportRequestBody {
  const request = defaultDatasetRequest(orderedAccountDataset, '', '')
  const groupings = datasetGroupings(orderedAccountDataset)
  const rows = [45, 44, 41, 40].map(type => groupings.find(item => item.type === type)!)
  return { ...request, sorted: { ...request.sorted, Row: rows, Col: [] }, ordering: structuredClone(accountOrdering) }
}
