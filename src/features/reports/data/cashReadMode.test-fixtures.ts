import type { ReportDataset } from '../types'
import { presentedCashDataset } from './workbookPresentation.test-fixtures'
export const cashReadModeCapability = { Version: 1, SupportedModes: [0, 1], CurrentDocumentsMaximumMonths: 120, LegacyInferencePreserved: true }
export const cashModeDataset: ReportDataset = { ...presentedCashDataset, cashReadMode: cashReadModeCapability }
