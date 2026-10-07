import type { ReportDataset } from '../types'
import { groupedCashWorkbookDataset } from './groupedCashPeriod.test-fixtures'
import { settlementAttributesDataset } from './settlementSourceAttributes.test-fixtures'
import { defaultDatasetRequest } from './reportDatasets'
import type { WorkbookPreview } from './workbookPreview'
import type { WorkbookCapability } from './workbookPresentation'

export const cashWorkbookCapability = { version: 1, additionalFields: [
  { type: 30, caption: 'Валюта рахунку (каси)', placement: 'inline' },
  { type: 33, caption: 'Вид коштів', placement: 'inline' }], orderings: [] }
export const presentedCashDataset: ReportDataset = { ...groupedCashWorkbookDataset,
  workbookPresentation: cashWorkbookCapability,
  groupedCashPeriod: { ...(groupedCashWorkbookDataset.groupedCashPeriod as object), PresentedWorkbookRows: [40] } }
export const presentedSettlementDataset: ReportDataset = { ...settlementAttributesDataset,
  workbookPresentation: { version: 1, additionalFields: [
    { type: 30, caption: 'Валюта взаєморозрахунків', placement: 'inline' },
    { type: 60, caption: 'Основний менеджер покупця', placement: 'column' },
    { type: 61, caption: 'Код по региону', placement: 'column' }], orderings: [] } }
export const presentedDayDataset: ReportDataset = {
  DataSource: 35, Name: 'Валовий прибуток за днем', Description: '', PeriodRequired: true, PeriodSupported: true,
  Groupings: [3, 4].map(Type => ({ Type, Name: String(Type) })),
  Measurements: [2, 3, 4, 6, 7, 8, 10, 12, 14, 15].map(Type => ({ Type, Name: String(Type) })),
  Filters: [0, 1, 2, 6, 9].map(Type => ({ Type, Name: String(Type) })), Limitations: [],
  dayOrganizationBasis: { Version: 1, DefaultBasis: 0, Bases: [0, 1], OperationalMaximumDays: 31,
    SignedRegisterMaximumDays: 1, LegacyInferenceWhenAbsent: true },
  productClassification: { Version: 1, SourceWorld: 0, RequiresIsService: true, RequiresProductKindId: true,
    ProductKindIdFormat: '32 hexadecimal characters (16 bytes)' },
  sourceOrganizations: { Version: 1, SourceWorlds: ['fenix'], MaximumOrganizationIds: 64,
    OrganizationIdFormat: '32 hexadecimal characters (16 bytes)', RequiresDurableNativeBinding: true, RequiresCompleteFactLineage: true },
  sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: '8AB2005056C0000811DEFC4535BB4D40',
    RequiresCompletePeriodLineage: true, UsesCurrentCapturedHierarchy: true },
  workbookPresentation: { version: 1, additionalFields: [
    { type: 2, caption: 'Номенклатура.Артикул (Окремо, Після групування)', placement: 'retainedSetting' },
    { type: 3, caption: 'Номенклатура.Топ (Вместе, Після групування)', placement: 'retainedSetting' }], orderings: ['MonthAscending'] },
}
export function presentedCashRequest() {
  const request = defaultDatasetRequest(presentedCashDataset, '2026-10-01', '2026-10-04')
  request.sorted.Row = request.sorted.Row.filter(row => row.type === 40)
  request.workbookPresentation = { version: 1, additionalFields: [30, 33], ordering: null }
  return request
}
export function workbookPreview() {
  const proof: WorkbookPreview = { version: 1, resultSha256: 'a'.repeat(64),
    selection: { version: 1, additionalFields: [30, 33], ordering: null },
    fields: structuredClone(cashWorkbookCapability.additionalFields) as WorkbookCapability['additionalFields'],
    rows: [{ rowSourceIndex: 12, rowKeySha256: 'b'.repeat(64),
      values: [{ type: 30, state: 'known', values: ['Гривня (UAH)'], inputSha256: null },
        { type: 33, state: 'known', values: ['Каса'], inputSha256: null }],
      currencyWitnesses: [{ id: '9223372036854775807', netUid: '11111111-2222-3333-4444-555555555555',
        name: 'Гривня', code: 'UAH', available: true }] }] }
  return { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
    Request: { DataSource: 'NativeCashPeriod', IsCurrentSnapshot: false, HasPeriod: true,
      ObservationStartedAtUtc: null, ObservationCompletedAtUtc: null, PeriodFrom: '01.10.2026', PeriodTo: '04.10.2026',
      ComparisonPeriodFrom: null, ComparisonPeriodTo: null, RowGroupings: ['Рахунок'], ColumnGroupings: [],
      Measures: ['Кін. залишок'], Filters: [], IgnoredFilters: [], Notes: [] },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    RowSchema: [{ Identity: 'PaymentRegister', Caption: 'Рахунок / каса' }], ColumnSchema: [{ Caption: 'Показник' }],
    Rows: [{ Ordinal: 0, SourceIndex: 12, Values: [{ Caption: 'Каса №1' }] }],
    Columns: [{ Ordinal: 0, SourceIndex: 0, Values: [{ Caption: 'Кін. залишок' }] }],
    Cells: [{ RowSourceIndex: 12, ColumnSourceIndex: 0, Value: { Kind: 'null', Value: null, Provenance: 'producerCell' } }],
    workbookPresentation: proof }
}
