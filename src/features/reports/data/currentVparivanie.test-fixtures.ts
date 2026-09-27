import type { ReportDataset } from '../types'
import { CURRENT_VPARIVANIE_PRODUCT_FIELDS, CURRENT_VPARIVANIE_TITLE } from './currentVparivanie'
import { defaultDatasetRequest } from './reportDatasets'

export const currentVparivanieDataset: ReportDataset = {
  DataSource: 39, Name: CURRENT_VPARIVANIE_TITLE, Description: 'Поточна кількість і період продажів',
  PeriodRequired: true, PeriodSupported: true,
  Groupings: [{ Type: 5, Name: 'Товар' }, { Type: 74, Name: 'Группа' }, { Type: 75, Name: 'Контрагент' }],
  Measurements: [{ Type: 83, Name: 'Результат' }],
  Filters: [1, 4, 5, 21, 60].map(Type => ({ Type, Name: `Фільтр ${Type}`, Selectable: Type !== 60 })),
  currentVparivanie: { Version: 1, StockAnchor: 'CurrentRecordedFree', PeriodCalendar: 'Europe/Kyiv', MaximumProducts: 128,
    MaximumFacts: 20000, MaximumWarehouses: 32, ProductDisplayColumns: [...CURRENT_VPARIVANIE_PRODUCT_FIELDS],
    FixedRowGroupings: [5], FixedColumnGroupings: [74, 75], FixedMeasurements: [83], ManagerFilterSupported: false,
    UnknownQuantity: 'null', MixedUnits: 'null', HistoricalStockSupported: false, HistoricalXlsParityVerified: false },
  Limitations: ['Менеджер покупця недоступний'],
}
export const exactSelection = (field: number, condition = 0, ids = ['9223372036854775807']) => ({ IsChecked: true,
  SelectedField: { Type: field, Name: `Поле ${field}` }, FilterCondition: { Type: condition, Name: `Умова ${condition}` },
  Values: ids.map(Id => ({ Data: { Id }, Name: `Значення ${Id}`, Value: 0 })) })
export function currentVparivanieRequest() {
  return { ...defaultDatasetRequest(currentVparivanieDataset, '2026-09-01', '2026-09-27'), selections: [exactSelection(1)] }
}
export function currentVparivaniePreview() {
  return {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
    Request: { DataSource: 'NativeCurrentVparivanie', IsCurrentSnapshot: false, HasPeriod: true,
      ObservationStartedAtUtc: '2026-09-27T10:00:00.0000000Z', ObservationCompletedAtUtc: '2026-09-27T10:00:01.0000000Z',
      PeriodFrom: '01.09.2026', PeriodTo: '27.09.2026', ComparisonPeriodFrom: null, ComparisonPeriodTo: null,
      RowGroupings: ['Товар'], ColumnGroupings: ['Группа', 'Контрагент'], Measures: ['Результат'],
      Filters: [], IgnoredFilters: [], Notes: ['Менеджер покупця поки недоступний.'] },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    RowSchema: [{ Identity: 'Product', Caption: 'Товар' }], ColumnSchema: [{ Identity: 'CurrentVparivanieGroup', Caption: 'Группа' }, { Identity: 'CurrentVparivanieCounterparty', Caption: 'Контрагент' }],
    Rows: [{ Ordinal: 0, SourceIndex: 12, Values: [{ Caption: 'synthetic product' }] }],
    Columns: [
      { Ordinal: 0, SourceIndex: 0, Values: [{ Caption: 'Остатки' }, { Caption: '' }, { Caption: 'Кількість' }, { Caption: 'Результат' }] },
      { Ordinal: 1, SourceIndex: 1, Values: [{ Caption: 'Продажи' }, { Caption: '' }, { Caption: 'Кількість' }, { Caption: 'Результат' }] },
      { Ordinal: 2, SourceIndex: 2, Values: [{ Caption: 'Контрагенты' }, { Caption: 'Одна назва' }, { Caption: 'Кількість' }, { Caption: 'Результат' }] },
      { Ordinal: 3, SourceIndex: 3, Values: [{ Caption: 'Контрагенты' }, { Caption: 'Одна назва' }, { Caption: 'Кількість' }, { Caption: 'Результат' }] },
    ],
    Cells: ['0', '-2.00000000', null, '3.00000001'].map((Value, ColumnSourceIndex) => ({ RowSourceIndex: 12, ColumnSourceIndex,
      Value: { Kind: Value === null ? 'null' : 'decimal', Value, Provenance: 'producerCell' } })),
    CurrentVparivanieProducts: { Version: 1, ResultSha256: 'a'.repeat(64), Rows: [{ RowSourceIndex: 12,
      Article: '0000123', Name: '<script>name</script>', Description: '', Group: 'Група', OE: null, Size: 'XL', Top: 'Так' }] },
  }
}
