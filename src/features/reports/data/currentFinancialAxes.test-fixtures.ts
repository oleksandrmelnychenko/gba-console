import type { CurrentFinancialAxes } from './currentFinancialAxes'
import { financialDataset, axisFields } from './financialAxes.test-fixtures'
import { defaultDatasetRequest } from './reportDatasets'
import type { ReportDataset } from '../types'

export const currentFinancialAxes: CurrentFinancialAxes = {
  version: 1, allowedRows: [3, 4, 12, 15], allowedColumns: [3, 4, 12, 15],
  minimumRows: 1, maximumRows: 2, maximumColumns: 1, maximumTotalDimensions: 2,
  maximumOutputColumns: 256, uniqueAcrossAxes: true, requiredProfitReadMode: 0, requiredDayOrganizationBasis: 0,
  groupings: [{ Type: 12, Name: 'Клієнт', Selectable: true }, { Type: 15, Name: 'Договір', Selectable: true }],
}
export const currentFinancialDataset: ReportDataset = { ...financialDataset, currentFinancialAxes }
export function currentFinancialRequest(rows = [12], cols = [15]) {
  const data = defaultDatasetRequest(currentFinancialDataset, '2026-10-17', '2026-10-23')
  return { ...data, profitReadMode: 0, dayOrganizationBasis: 0,
    sorted: { ...data.sorted, Row: axisFields(rows), Col: axisFields(cols) } }
}
