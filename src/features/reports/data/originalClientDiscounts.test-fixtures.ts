import type { ReportDataset } from '../types'
import { CLIENT_DISCOUNTS_ORIGINAL_ID } from './originalClientDiscounts'

export function clientDiscountsDataset(): ReportDataset {
  return { DataSource: 25, Name: 'Знижки клієнтів', Description: 'OUR last slice', PeriodRequired: false,
    PeriodSupported: false, Limitations: [], Groupings: [55, 53, 62, 58].map(Type => ({ Type, Name: String(Type) })),
    Measurements: [{ Type: 64, Name: 'Відсоток' }], Filters: [43, 41, 50, 46].map(Type => ({ Type, Name: String(Type) })),
    discountMarkup: { Version: 1, SourceWorlds: [1, 2] },
    originalClientDiscounts: { Version: 1, SourceWorld: 'fenix', OriginalId: CLIENT_DISCOUNTS_ORIGINAL_ID,
      DefinitionSha256: 'e355fd45fed1b64f52704baa92f09755b91bea96be74953c182f65b1c8fcc637',
      QuerySha256: '6176122623be4ad0696ff2b614943d645c9290b094f9babe7f0f48854e13e2b8',
      Rows: [55], Columns: [53], Measures: [64], DefaultFilters: [41, 43, 50],
      Aggregation: 'MaximumAtSelectedGrouping', AdditionalRecipientField: 'КодПоРегиону',
      CurrentSourceVerified: false, ParityVerified: false } }
}
export function clientDiscountsPreview() {
  return { Version: 1, PresentationOnly: true, ResultSha256: 'a'.repeat(64),
    Request: { DataSource: 'NativeOneCClientDiscounts', IsCurrentSnapshot: false, HasPeriod: true,
      ObservationStartedAtUtc: null, ObservationCompletedAtUtc: null, PeriodFrom: '12.09.2026', PeriodTo: '12.09.2026',
      ComparisonPeriodFrom: null, ComparisonPeriodTo: null, RowGroupings: ['Одержувач'], ColumnGroupings: ['Товар'],
      Measures: ['Відсоток'], Filters: [], IgnoredFilters: [], Notes: [] },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    RowSchema: [{ Identity: 'OneCDiscountClient', Caption: 'Одержувач' }], ColumnSchema: [{ Caption: 'Товар' }],
    Rows: [{ Ordinal: 0, SourceIndex: 12, Values: [{ Caption: 'Client' }] }],
    Columns: [{ Ordinal: 0, SourceIndex: 0, Values: [{ Caption: 'Product' }, { Caption: 'Відсоток' }] }],
    Cells: [{ RowSourceIndex: 12, ColumnSourceIndex: 0, Value: { Kind: 'decimal', Value: '20', Provenance: 'producerCell' } }],
    ClientDiscountRecipientRegions: { Version: 1, ResultSha256: 'a'.repeat(64), Rows: [{ RowSourceIndex: 12, RegionCode: '01' }] } }
}
