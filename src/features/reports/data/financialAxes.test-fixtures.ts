import type { ReportDataset } from '../types'
import { profitDayDataset } from './profitReadMode.test-fixtures'
import type { FinancialAxes } from './financialAxes'
import type { ReportConfiguration } from './reportConfiguration'

export const financialAxes: FinancialAxes = { version: 1, allowedRows: [3, 4], allowedColumns: [3, 4],
  minimumRows: 1, maximumRows: 2, maximumColumns: 1, maximumOutputColumns: 256, uniqueAcrossAxes: true }
const period = { required: true, supported: true, maximumDays: 31, maximumMonths: null, minimumDate: null }
export const financialConfiguration: ReportConfiguration = { version: 1, axisMode: 'profitRows',
  allowedRows: [3, 4], allowedColumns: [3, 4], minimumRows: 1, maximumRows: 2, maximumColumns: 1,
  allowRowReorder: true, rowLayouts: [], columnLayouts: [], mutuallyExclusiveRows: [], period,
  variants: [{ key: 'originalNormal', period: { ...period, maximumDays: null, maximumMonths: 120 } },
    { key: 'signedRegister', period: { ...period, maximumDays: 1 } }] }
export const financialDataset: ReportDataset = { ...profitDayDataset, financialAxes, configuration: financialConfiguration,
  Groupings: [{ Type: 3, Name: 'Дата' }, { Type: 4, Name: 'Організація' }] }
export const financialSourceFilters = {
  productClassification: { Version: 1, SourceWorld: 0, ProductKindId: '8AB2005056C0000811DEF956DA4CFDA0', IsService: false },
  sourceOrganizations: { Version: 1, SourceWorld: 'fenix', OrganizationIds: ['00000000000000000000000000000001'] },
  sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: '8AB2005056C0000811DEFC4535BB4D40' },
}
export const axisFields = (types: number[]) => types.map(type => ({ type, key: String(type), label: String(type) }))
