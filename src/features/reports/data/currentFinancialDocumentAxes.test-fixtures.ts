import type { CurrentFinancialDocumentAxes } from './currentFinancialDocumentAxes'
import { productTimeDataset, productTimeRequest } from './currentFinancialProductTimeAxes.test-fixtures'
import { financialFilterCapability, financialFilterRequest } from './currentFinancialFilterConditions.test-fixtures'
import type { ReportDataset } from '../types'

export const documentAxes: CurrentFinancialDocumentAxes = {
  version: 1, allowedRows: [0, 1, 2, 3, 4, 5, 12, 15, 81], allowedColumns: [0, 1, 2, 3, 4, 5, 12, 15, 81],
  minimumRows: 1, maximumRows: 2, maximumColumns: 1, maximumTotalDimensions: 2,
  maximumOutputColumns: 256, uniqueAcrossAxes: true, quantitySupported: false,
  requiredProfitReadMode: 0, requiredDayOrganizationBasis: 0,
  groupings: [{ Type: 81, Name: 'Документ', Selectable: true }],
}
export const documentDataset: ReportDataset = { ...productTimeDataset, currentFinancialDocumentAxes: documentAxes,
  currentFinancialFilterConditions: financialFilterCapability }
export const documentRequest = (rows = [81], cols = [5]) => ({ ...productTimeRequest(rows, cols),
  selections: financialFilterRequest(9, 4, ['9007199254740993']).selections })
export const documentLayouts: [number[], number[]][] = [[[81], []], ...[0, 1, 2, 3, 4, 5, 12, 15]
  .flatMap(type => [[[81, type], []], [[type, 81], []], [[81], [type]], [[type], [81]]] as [number[], number[]][]) ]

const scalar = (Kind: string, Value: string | null) => ({ Kind, Value, Provenance: 'rowAxisKey' })
const dimensions: Record<number, { name: string; key: ReturnType<typeof scalar> }> = {
  0: { name: 'Year', key: scalar('signedInteger', '2026') },
  1: { name: 'Quarter', key: scalar('dateTime', '2026-10-01T00:00:00.0000000') },
  2: { name: 'Month', key: scalar('dateTime', '2026-10-01T00:00:00.0000000') },
  3: { name: 'Day', key: scalar('dateTime', '2026-10-17T00:00:00.0000000') },
  4: { name: 'Organization', key: scalar('signedInteger', '1') },
  5: { name: 'Product', key: scalar('signedInteger', '9223372036854775807') },
  12: { name: 'CustomerName', key: scalar('signedInteger', '12') },
  15: { name: 'CustomerContract', key: scalar('null', null) },
  81: { name: 'CurrentFinancialDocument', key: scalar('text', 'return:9007199254740993') },
}
export function documentPreviewPayload(rows = [81], columns = [5]) {
  const schema = (types: number[]) => types.map(type => ({ Caption: dimensions[type].name, Identity: dimensions[type].name,
    ...(type === 81 ? { DisplayKind: 'Text', KeyKind: 'Text', Captioned: true } : {}) }))
  const values = (types: number[]) => types.map(type => ({ Caption: type === 81 ? 'Повернення №42 · 17.10.2026 10:30:21' : dimensions[type].name,
    Identity: { ...dimensions[type].key } }))
  return { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
    Request: { DataSource: 'NativeDayOrganizationGrossProfit', ProfitReadMode: 0, IsCurrentSnapshot: false,
      ObservationStartedAtUtc: null, ObservationCompletedAtUtc: null, HasPeriod: true, PeriodFrom: '2026-10-17', PeriodTo: '2026-10-23',
      ComparisonPeriodFrom: null, ComparisonPeriodTo: null, RowGroupings: rows.map(type => dimensions[type].name),
      ColumnGroupings: columns.map(type => dimensions[type].name), Measures: ['Продажі'], Filters: [], IgnoredFilters: [], Notes: [] },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    RowSchema: schema(rows), ColumnSchema: [...schema(columns), { Caption: 'Прибуток', Identity: '$measureGroup' }, { Caption: 'Показник', Identity: '$measure' }],
    Rows: [{ Ordinal: 0, SourceIndex: 0, Values: values(rows) }],
    Columns: [{ Ordinal: 0, SourceIndex: 0, Values: [...values(columns),
      { Caption: 'Прибуток', Identity: scalar('text', 'profit') },
      { Caption: 'Продажі', Identity: scalar('reportField', 'SalesValueWithVAT') }] }],
    Cells: [{ RowSourceIndex: 0, ColumnSourceIndex: 0, Value: scalar('decimal', '-7.00') }],
  }
}
