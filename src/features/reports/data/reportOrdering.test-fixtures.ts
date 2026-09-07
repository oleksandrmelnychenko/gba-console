import type { ReportDataset, ReportOrdering, ReportRequestBody } from '../types'
import { accountBalanceDataset } from './accountBalances.test-fixtures'
import { defaultDatasetRequest } from './reportDatasets'
export const orderedAccountDataset: ReportDataset = { ...accountBalanceDataset, Ordering: { Version: 1, MaximumRules: 32,
  Groupings: accountBalanceDataset.Groupings.map(field => ({ Type: field.Type, By: [1, 2, 3] })) } }
export const accountOrdering: ReportOrdering = { Version: 1, Rows: [{ Grouping: 40, By: 3, Measure: 24, Direction: 2, Nulls: 2 }], Columns: [] }
export function orderedAccountRequest(): ReportRequestBody { return { ...defaultDatasetRequest(orderedAccountDataset, '', ''), ordering: structuredClone(accountOrdering) } }
