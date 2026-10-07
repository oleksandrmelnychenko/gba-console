import type { ReportDataset, ReportRequestBody } from '../types'
import { cashPeriodManagementDataset } from './cashPeriod.test-fixtures'
import { CASH_PERIOD_ALL_MEASURES, CASH_PERIOD_ROWS } from './cashPeriod'
import { defaultGroupedCashPeriod, GROUPED_CASH_FILTERS } from './groupedCashPeriod'
import { defaultDatasetRequest } from './reportDatasets'
export const groupedCashDataset: ReportDataset = { ...cashPeriodManagementDataset,
  Description: 'Поточні банки та каси', Filters: GROUPED_CASH_FILTERS.map(Type => ({ Type, Name: `Відбір ${Type}` })),
  groupedCashPeriod: { Version: 1, MaximumDays: 31, CurrencyBasis: 'AccountAndManagementCurrency',
    UsesCurrentNativeAccounts: true, PreservesUnavailableValues: true, RequiresCommonSourceObservation: false,
    FixedRowGroupings: [...CASH_PERIOD_ROWS], FixedMeasurements: [...CASH_PERIOD_ALL_MEASURES],
    Filters: [...GROUPED_CASH_FILTERS], RegisterKinds: [1, 2] },
}
export const groupedCashRequest = (): ReportRequestBody => ({ ...defaultDatasetRequest(groupedCashDataset, '2026-09-01', '2026-09-30'),
  groupedCashPeriod: defaultGroupedCashPeriod() })

export const groupedCashWorkbookDataset: ReportDataset = { ...groupedCashDataset,
  Groupings: [...groupedCashDataset.Groupings, { Type: 44, Name: 'Тип рахунку', Selectable: true }],
  groupedCashPeriod: { ...(groupedCashDataset.groupedCashPeriod as Record<string, unknown>),
    RowLayouts: [[43, 40, 42, 41], [40, 44, 43]] },
}
