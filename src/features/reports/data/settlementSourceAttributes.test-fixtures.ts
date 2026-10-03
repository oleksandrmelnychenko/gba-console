import type { ReportDataset } from '../types'
import { groupedSettlementSupplierDataset } from './groupedSettlementSupplier.test-fixtures'
import { defaultDatasetRequest } from './reportDatasets'
import type { SettlementCounterpartyAttribute } from './settlementSourceAttributes'
export const settlementAttributesDataset: ReportDataset = { ...groupedSettlementSupplierDataset,
  groupedSettlementPeriod: { ...(groupedSettlementSupplierDataset.groupedSettlementPeriod as Record<string, unknown>),
    Filters: [0, 6, 9, 17, 18, 30, 60, 61], SourceAttributeWorlds: ['Fenix'],
    AdditionalFields: ['Основний менеджер покупця', 'Код по региону'] },
  Filters: [...groupedSettlementSupplierDataset.Filters,
    { Type: 60, Name: 'Основний менеджер покупця (ID джерела)' }, { Type: 61, Name: 'Код по региону (джерело покупця)' }],
}
export const settlementAttributesRequest = () => defaultDatasetRequest(settlementAttributesDataset, '2026-09-01', '2026-09-30')
export const knownSettlementAttribute = (): SettlementCounterpartyAttribute => ({ RowSourceIndex: 12,
  ManagerAvailable: true, ManagerName: ' Manager🙂 ', ManagerAssigned: true,
  RegionAvailable: true, RegionCode: ' B🙂 ', InputSha256: 'b'.repeat(64) })
export function settlementAttributePreview(row = knownSettlementAttribute()) {
  return { Version: 1, PresentationOnly: true, ResultSha256: 'a'.repeat(64),
    Request: { DataSource: 'NativeSettlementPeriod', IsCurrentSnapshot: false, HasPeriod: true,
      ObservationStartedAtUtc: null, ObservationCompletedAtUtc: null, PeriodFrom: '01.09.2026', PeriodTo: '30.09.2026',
      ComparisonPeriodFrom: null, ComparisonPeriodTo: null, RowGroupings: ['Організація', 'Валюта', 'Контрагент'],
      ColumnGroupings: [], Measures: ['Поч. залишок', 'Надходження', 'Видаток', 'Кін. залишок'], Filters: [], IgnoredFilters: [], Notes: [] },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    RowSchema: [{ Identity: 'Organization', Caption: 'Організація' }, { Identity: 'PaymentCurrency', Caption: 'Валюта' },
      { Identity: 'SettlementCounterparty', Caption: 'Контрагент' }], ColumnSchema: [{ Caption: 'Показник' }],
    Rows: [{ Ordinal: 0, SourceIndex: 12, Values: [{ Caption: 'Current organization' }, { Caption: 'UAH' }, { Caption: 'Current buyer' }] }],
    Columns: [{ Ordinal: 0, SourceIndex: 0, Values: [{ Caption: 'Кін. залишок' }] }],
    Cells: [{ RowSourceIndex: 12, ColumnSourceIndex: 0, Value: { Kind: 'decimal', Value: '0', Provenance: 'producerCell' } }],
    SettlementCounterpartyAttributes: { Version: 1, ResultSha256: 'a'.repeat(64), Rows: [row] },
  }
}
