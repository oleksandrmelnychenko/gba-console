import type { ReportDataset, ReportRequestBody } from '../types'

export const currentProvidedDiscountsDataset: ReportDataset = {
  DataSource: 24, Name: 'Надані знижки', Description: 'Поточні надані знижки',
  Groupings: [57, 55, 53, 59, 60, 61, 0, 1, 2, 3].map(Type => ({ Type, Name: String(Type) })),
  Measurements: [{ Type: 65, Name: 'Сума знижки' }, { Type: 66, Name: 'ПДВ знижки' }],
  Filters: [{ Type: 45, Name: 'Договір 1С' }, { Type: 41, Name: 'Товар 1С' }],
  Limitations: [], PeriodRequired: true, PeriodSupported: true,
  providedDiscounts: { Version: 1, SourceWorlds: [1, 2], Bases: [0, 1], DefaultNewBasis: 0,
    OperationalSourceWorlds: [1], OperationalMissingInputsRemainNull: true },
}
export const providedDiscountRequest = (Basis?: 0 | 1 | null): ReportRequestBody => ({
  dataSource: 24, from: '2026-09-01', to: '2026-09-30',
  providedDiscounts: { Version: 1, SourceWorld: 1, ...(Basis === undefined ? {} : { Basis }) },
  sorted: { Row: [{ type: 57 }], Col: [], Measurements: [{ Type: 65, IsChecked: true }, { Type: 66, IsChecked: true }] }, selections: [],
})
