import type { ReportDataset, ReportFilterExpression, ReportFilterExpressionCapabilities, ReportRequestBody } from '../types'
import { accountBalanceSelections } from './accountBalances.test-fixtures'
import { orderedAccountDataset, orderedAccountRequest } from './reportOrdering.test-fixtures'
export const expressionCapabilities: ReportFilterExpressionCapabilities = { Version: 1, MaximumDepth: 8, MaximumLeaves: 64, MaximumNodes: 128, Operators: [1, 2] }
export const expressionDataset: ReportDataset = { ...orderedAccountDataset, FilterExpression: expressionCapabilities }
export const nestedExpression: ReportFilterExpression = { Version: 1, Root: { Kind: 1, Children: [
  { Kind: 3, SelectionIndex: 1 }, { Kind: 2, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 2 }] },
] } }
export function expressionRequest(): ReportRequestBody {
  return { ...orderedAccountRequest(), selections: structuredClone(accountBalanceSelections), filterExpression: structuredClone(nestedExpression) }
}
