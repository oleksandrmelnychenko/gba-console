import type { ReportDataset, ReportSelection } from '../types'
import { groupedSettlementDataset } from './groupedSettlementPeriod.test-fixtures'
import { defaultDatasetRequest } from './reportDatasets'
import { GROUPED_SETTLEMENT_SUPPLIER_FILTERS } from './groupedSettlementPeriod'

export const groupedSettlementSupplierDataset: ReportDataset = {
  ...groupedSettlementDataset,
  groupedSettlementPeriod: { ...(groupedSettlementDataset.groupedSettlementPeriod as Record<string, unknown>),
    UsesCurrentNativeSupplierAgreements: true, Filters: [...GROUPED_SETTLEMENT_SUPPLIER_FILTERS] },
  Filters: [
    { Type: 0, Name: 'Організація' }, { Type: 6, Name: 'Покупець' }, { Type: 9, Name: 'Договір покупця' },
    { Type: 17, Name: 'Постачальник' }, { Type: 18, Name: 'Договір постачальника' }, { Type: 30, Name: 'Валюта' },
  ],
}
export const groupedSettlementSupplierRequest = () => defaultDatasetRequest(groupedSettlementSupplierDataset, '2026-09-01', '2026-09-30')
export const supplierSelection = (field: 17 | 18, id: string, condition = 0): ReportSelection => ({
  IsChecked: true, SelectedField: { Type: field, Name: field === 17 ? 'Supplier' : 'SupplierContract' },
  FilterCondition: { Type: condition, Name: 'Synthetic condition' },
  Values: [{ Data: { Id: id, Name: 'Synthetic supplier identity' }, Name: 'Synthetic supplier identity', Value: 0 }],
})
