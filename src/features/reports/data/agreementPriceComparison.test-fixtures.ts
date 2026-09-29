import type { ReportDataset } from '../types'

export const comparisonDataset: ReportDataset = {
  DataSource: 31, Name: 'Порівняння цін двох договорів', Description: 'Поточні договірні ціни EUR',
  PeriodSupported: false, PeriodRequired: false,
  Groupings: [{ Type: 5, Name: 'Товар' }, { Type: 28, Name: 'Одиниця виміру' }],
  Measurements: [75, 76, 77, 78].map(Type => ({ Type, Name: `Показник ${Type}` })),
  Filters: [], Limitations: ['Не підсумовувати ціни різних товарів.'],
  agreementPriceComparison: { version: 1, required: true, maximumRequestedIds: 2000, maximumProducts: 1000,
    requiredRows: [5, 28], measurements: [75, 76, 77, 78] },
}
