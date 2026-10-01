import type { ReportDataset } from '../types'
import { defaultDatasetRequest } from './reportDatasets'
import { settlementPeriodDataset } from './settlementPeriod.test-fixtures'
import { FENIX_BUYERS_ROOT_ID } from './nativeExactFilters'

export const groupedSettlementDataset: ReportDataset = {
  ...settlementPeriodDataset,
  groupedSettlementPeriod: {
    Version: 1, MaximumDays: 31, CurrencyBasis: 'SettlementCurrency', UsesCurrentNativeBuyerAgreements: true,
    PreservesUnavailableValues: true, RequiresCommonSourceObservation: false, CurrentDaySupported: true,
    SourceWorlds: ['Fenix', 'Amg'], RowLayouts: [[4, 41, 76], [4, 76]], Measurements: [88, 89, 90, 91], Filters: [0, 6, 9, 30],
    FilterExpression: { Version: 1, MaximumDepth: 8, MaximumLeaves: 64, MaximumNodes: 128, Operators: [1, 2] },
    BuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID,
      RequiresCompletePeriodLineage: false, UsesCurrentCapturedHierarchy: true },
  },
  Filters: [0, 6, 9, 30].map(Type => ({ Type, Name: ['Організація', 'Покупець', 'Договір', 'Валюта'][[0, 6, 9, 30].indexOf(Type)] })),
}

export const groupedSettlementRequest = () => defaultDatasetRequest(groupedSettlementDataset, '2026-09-01', '2026-09-12')
