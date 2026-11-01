import type { ReportDataset, ReportRequestBody } from '../types'
import { defaultDatasetRequest } from './reportDatasets'
import { parseReportDatasets } from '../api/reportWorkspaceApi'
import customerComparison from './customerGroupWarehouse.server-fixture.json'
export const ownPresentationSources = [3, 45, 46] as const
export const presentationSourceNames: Record<number, string> = { 3: 'NativePurchases', 45: 'NativeStockPeriod', 46: 'NativePriceComparison' }
export const presentationCombinations = [
  { version: 1 as const, negativeRed: false, grandTotals: false },
  { version: 1 as const, negativeRed: false, grandTotals: true },
  { version: 1 as const, negativeRed: true, grandTotals: false },
  { version: 1 as const, negativeRed: true, grandTotals: true },
]
const fields: Record<number, Array<[number, string]>> = {
  3: [[96, 'PurchaseNetWeight'], [2, 'SalesValueWithoutVAT'], [3, 'SalesValueVAT'], [0, 'SalesQuantity']],
  45: [[97, 'StockPeriodOpeningQuantity'], [100, 'StockPeriodIncomingQuantity'], [103, 'StockPeriodOutgoingQuantity'], [106, 'StockPeriodClosingQuantity']],
  46: [[2, 'SalesValueWithoutVAT'], [67, 'OneCSalesValueBeforeDiscount'], [68, 'OneCSalesDiscountAmount'], [70, 'OneCPriceTypeValue']],
}
export function ownPresentationDataset(source: number): ReportDataset {
  if (source === 44) return { ...parseReportDatasets([customerComparison.dataset])[0],
    constructorPresentation: { version: 1, fields: ['negativeRed', 'grandTotals'] } }
  return { DataSource: source, Name: 'GBA', Description: '', PeriodRequired: true, PeriodSupported: true,
    Groupings: [{ Type: source === 46 ? 10 : source === 45 ? 29 : 21,
      Name: source === 46 ? 'Групи' : source === 45 ? 'Склад' : 'Постачальник' }, { Type: 5, Name: 'Товар' }],
    Measurements: (fields[source] ?? fields[3]).map(([Type, Name]) => ({ Type, Name, Selectable: true })), Filters: [], Limitations: [],
    constructorPresentation: { version: 1, fields: ['negativeRed', 'grandTotals'] } }
}
export function ownPresentationRequest(source: number): ReportRequestBody {
  const dataset = ownPresentationDataset(source), data = defaultDatasetRequest(dataset, '2026-10-01', '2026-10-27')
  data.sorted.Row = dataset.Groupings.filter(field => source !== 44 || field.Type === 5).map(field => ({ type: field.Type, key: field.Name, label: field.Name }))
  if (source === 44) {
    data.sorted.Col = dataset.Groupings.filter(field => field.Type === 82).map(field => ({ type: field.Type, key: field.Name, label: field.Name }))
    const groups = structuredClone(customerComparison.request.CustomerGroups)
    if (groups.Version !== 1) throw new Error('Unsupported checked-in comparison version')
    data.customerGroups = { Version: groups.Version, Groups: groups.Groups }
  }
  return data
}
// Authored rendering/retention fixture only, never a SQL/HTTP financial witness.
export function ownPresentationPreview(source: number, selection?: unknown) {
  const measures = fields[source], amounts = ['8.125', '-5.125', '0.000', null]
  const scalar = (raw: string | null) => ({ Kind: raw === null ? 'null' : 'decimal', Value: raw, Provenance: 'presentationExample' })
  const cells = (row: number) => amounts.map((raw, column) => ({ RowSourceIndex: row, ColumnSourceIndex: column, Value: scalar(raw) }))
  const group = source === 46 ? { Identity: 'ProductGroup', Caption: 'Групи', Captioned: true, KeyKind: 'Text', DisplayKind: 'Text' }
    : { Identity: source === 45 ? 'StockWarehouse' : 'Supplier', Caption: source === 45 ? 'Склад' : 'Постачальник', Captioned: true, KeyKind: 'Numeric', DisplayKind: 'Text' }
  return { Version: 1, ResultSha256: 'b'.repeat(64), PresentationOnly: true,
    ...(selection === undefined ? {} : { constructorPresentation: selection }),
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    Request: { DataSource: presentationSourceNames[source], IsCurrentSnapshot: false, HasPeriod: true,
      PeriodFrom: '01.10.2026', PeriodTo: '27.10.2026', RowGroupings: [group.Caption, 'Товар'], ColumnGroupings: [],
      Measures: measures.map(item => item[1]), Filters: [], IgnoredFilters: [], Notes: [] },
    RowSchema: [group, { Identity: 'Product', Caption: 'Товар', Captioned: true, KeyKind: 'Numeric', DisplayKind: 'Text' }],
    ColumnSchema: [{ Identity: '$measure', Caption: 'Показник' }],
    Rows: [{ Ordinal: 0, SourceIndex: 0, Values: [
      { Caption: 'Група / склад', Identity: { Kind: source === 46 ? 'text' : 'signedInteger', Value: source === 46 ? '["2","10"]' : '21', Provenance: 'rowAxisKey' } },
      { Caption: 'Товар', Identity: { Kind: 'signedInteger', Value: '38242326', Provenance: 'rowAxisKey' } }] }],
    Columns: measures.map(([, field], index) => ({ Ordinal: index, SourceIndex: index, Values: [
      { Caption: field, Identity: { Kind: 'reportField', Value: field, Provenance: 'columnAxisKey' } }] })),
    Cells: cells(0), Totals: { State: 'materialized', Values: cells(-1), Groups: [{ Level: 0, RowSourceIndex: 0, RowCount: 1, Values: cells(0) }] } }
}
