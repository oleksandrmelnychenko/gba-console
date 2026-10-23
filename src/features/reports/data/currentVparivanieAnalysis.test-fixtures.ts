import datasetFixture from './currentVparivanieAnalysis.dataset-fixture.json'
import type { ReportDataset } from '../types'
import { currentVparivanieRequest } from './currentVparivanie.test-fixtures'
import { CURRENT_VPARIVANIE_FULL_NOTE } from './currentVparivanie'
import { upgradeCurrentVparivanieAnalysis } from './currentVparivanieAnalysis'
export const analysisDataset = datasetFixture as unknown as ReportDataset
export const analysisRequest = () => upgradeCurrentVparivanieAnalysis({ ...currentVparivanieRequest(), sorted: {
  ...currentVparivanieRequest().sorted, Row: [{ type: 5, key: 'Product', label: 'Товар' }, { type: 2, key: 'Month', label: 'Місяць' }],
  Col: [{ type: 74, key: 'CurrentVparivanieGroup', label: 'Показник' }],
} }, analysisDataset)
export function analysisPreview() {
  const scalar = (Kind: string, Value: string) => ({ Kind, Value, Provenance: 'rowAxisKey' })
  return {
    Version: 1, PresentationOnly: true, ResultSha256: 'a'.repeat(64), RequestSha256: 'b'.repeat(64),
    Request: { DataSource: 'NativeCurrentVparivanie', IsCurrentSnapshot: false, HasPeriod: true,
      currentVparivanieAnalysis: { version: 1 }, PeriodFrom: '01.09.2026', PeriodTo: '27.09.2026',
      ObservationStartedAtUtc: '2026-10-23T10:00:00Z', ObservationCompletedAtUtc: '2026-10-23T10:00:01Z',
      RowGroupings: ['Товар', 'Місяць'], ColumnGroupings: ['Показник'], Measures: ['Результат'],
      Filters: [], IgnoredFilters: [], Notes: [CURRENT_VPARIVANIE_FULL_NOTE] },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    RowSchema: [{ Identity: 'Product', Caption: 'Товар' }, { Identity: 'Month', Caption: 'Місяць' }],
    ColumnSchema: [{ Identity: 'CurrentVparivanieGroup', Caption: 'Показник' }, { Identity: '$measureGroup', Caption: 'Показник' }, { Identity: '$measure', Caption: 'Показник' }],
    Rows: [{ Ordinal: 0, SourceIndex: 0, Values: [{ Caption: '000123', Identity: scalar('signedInteger', '123') },
      { Caption: 'Не застосовується', Identity: scalar('text', 'analysis:na') }] }],
    Columns: [{ Ordinal: 0, SourceIndex: 0, Values: [{ Caption: 'Залишки', Identity: scalar('signedInteger', '1') }, { Caption: 'Результат' }, { Caption: 'Результат' }] }],
    Cells: [{ RowSourceIndex: 0, ColumnSourceIndex: 0, Value: { Kind: 'decimal', Value: '5', Provenance: 'producerCell' } }],
    currentVparivanieAnalysis: { version: 1, allSalesFilterScope: true, stockAllocation: 'periodEndOnly', physicalCalendar: 'Europe/Kyiv',
      incoming: false, outgoing: false, resultSha256: 'a'.repeat(64), fieldCoverage: [
        ...[5, 2, 74].map(field => ({ field, scope: 'grouping', knownFacts: 1, unknownFacts: 0, notApplicableFacts: field === 2 ? 1 : 0, reasons: [] as string[] })),
      ] },
  }
}
