import type { CurrentFinancialProductTimeAxes } from './currentFinancialProductTimeAxes'
import { currentFinancialDataset, currentFinancialRequest } from './currentFinancialAxes.test-fixtures'
import type { ReportDataset } from '../types'

export const productTimeAxes: CurrentFinancialProductTimeAxes = {
  version: 1, allowedRows: [0, 1, 2, 3, 4, 5, 12, 15], allowedColumns: [0, 1, 2, 3, 4, 5, 12, 15],
  minimumRows: 1, maximumRows: 2, maximumColumns: 1, maximumTotalDimensions: 2,
  maximumOutputColumns: 256, uniqueAcrossAxes: true, quantitySupported: false,
  requiredProfitReadMode: 0, requiredDayOrganizationBasis: 0,
  groupings: [{ Type: 0, Name: 'Рік', Selectable: true }, { Type: 1, Name: 'Квартал', Selectable: true },
    { Type: 2, Name: 'Місяць', Selectable: true }, { Type: 5, Name: 'Товар', Selectable: true },
    { Type: 12, Name: 'Клієнт', Selectable: true }, { Type: 15, Name: 'Договір', Selectable: true }],
}
export const productTimeDataset: ReportDataset = { ...currentFinancialDataset, currentFinancialProductTimeAxes: productTimeAxes }
export const productTimeRequest = (rows = [5], cols = [2]) => currentFinancialRequest(rows, cols)
