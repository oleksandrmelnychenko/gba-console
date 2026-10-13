import type { ReportDataset } from '../types'
import { presentedSettlementDataset } from './workbookPresentation.test-fixtures'
export const settlementReadModeCapability = { Version: 1, SupportedModes: [0, 1], CurrentDocumentsMaximumMonths: 120, LegacyInferencePreserved: true }
export const settlementModeDataset: ReportDataset = { ...presentedSettlementDataset,
  groupedSettlementPeriod: { ...presentedSettlementDataset.groupedSettlementPeriod as object,
    OriginalNormalMaximumMonths: 120, OriginalNormalMinimumDate: '2025-01-01' },
  settlementReadMode: settlementReadModeCapability }
