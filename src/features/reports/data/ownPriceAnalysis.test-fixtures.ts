import type { ReportDataset } from '../types'

export const ownPriceAnalysisDataset: ReportDataset = {
  DataSource: 28, Name: '1С: Аналіз цін', Description: 'Ціни з імпортованих даних і курси нашої бази',
  Groupings: [68, 69, 70, 71, 72].map(Type => ({ Type, Name: String(Type) })),
  Measurements: [{ Type: 72, Name: 'Ціна' }, { Type: 73, Name: 'Відхилення, %' }],
  Filters: [], Limitations: [], PeriodRequired: false, PeriodSupported: false,
  priceAnalysis: { Version: 1, SourceWorlds: [1], SupportedVersions: [1, 2],
    OwnCommercialRatesSupported: true, CoverageStatus: 'native_partial',
    AgreementPricingSupported: false, RecommendationEligible: false },
}
