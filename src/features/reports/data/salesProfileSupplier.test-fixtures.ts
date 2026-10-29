import type { ReportDataset } from '../types'
import { grossDataset, netDataset } from './reportDatasets.test-fixtures'
export const supplierField = { Type: 21, Name: 'Постачальник', Selectable: true }
const groupings = grossDataset.Groupings.filter(field => field.Type !== 21)
export const supplierProfileDataset: ReportDataset = { ...netDataset, Groupings: groupings,
  reportProfiles: ['sales', 'grossProfit'], profileGroupings: { sales: [supplierField], grossProfit: [supplierField] },
  constructorPresentation: { version: 1, fields: ['negativeRed', 'grandTotals'] },
  configuration: { version: 1, axisMode: 'flexible', allowedRows: groupings.map(field => field.Type), allowedColumns: groupings.map(field => field.Type),
    minimumRows: 1, maximumRows: 8, maximumColumns: 4, allowRowReorder: true, rowLayouts: [], columnLayouts: [], mutuallyExclusiveRows: [],
    period: { required: true, supported: true, maximumDays: null, maximumMonths: null, minimumDate: '1900-01-01', maximumDate: '9998-12-31' }, variants: [] },
}
