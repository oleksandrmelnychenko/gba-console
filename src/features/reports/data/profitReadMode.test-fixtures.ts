import type { ReportDataset } from '../types'
import { presentedDayDataset } from './workbookPresentation.test-fixtures'
export const profitReadModeCapability = { Version: 1, SupportedModes: [0, 1], CurrentDocumentsMaximumDays: 31, LegacyInferencePreserved: true }
export const profitDayDataset: ReportDataset = { ...presentedDayDataset, profitReadMode: profitReadModeCapability }
export const profitSupplierDataset: ReportDataset = {
  DataSource: 38, Name: 'Валовий прибуток за постачальниками', Description: '', PeriodRequired: true, PeriodSupported: true,
  profitReadMode: profitReadModeCapability,
  supplierBasis: { Version: 1, DefaultBasis: 0, Bases: [0, 1], MaximumDays: 31,
    IncludesReturns: true, PreservesUnavailableValues: true, RegistrarWarehouseGrouping: 78 },
  supplierSourceWorld: { Version: 1, SourceWorlds: [0, 1], RequiresCompletePeriodLineage: true },
  sourceBuyerSubtree: presentedDayDataset.sourceBuyerSubtree,
  Groupings: [73, 78, 4, 21].map(Type => ({ Type, Name: String(Type) })),
  Measurements: [0, 2, 3, 4, 6, 7, 8, 10, 12, 14].map(Type => ({ Type, Name: String(Type) })),
  Filters: [0, 1, 17].map(Type => ({ Type, Name: String(Type) })), Limitations: [],
}
