import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { ReportInlinePreview } from './ReportInlinePreview'

const amount = (value: string) => ({ Kind: 'decimal', Value: value, Provenance: 'producerCell' })
const total = (row: number, value: string) => ({ RowSourceIndex: row, ColumnSourceIndex: 0, Value: { ...amount(value), Provenance: 'presentationTotal' } })
const key = (caption: string) => ({ Caption: caption, Identity: { Kind: 'text', Value: caption, Provenance: 'rowAxisKey' } })
const row = (index: number, warehouse: string, organization: string, supplier: string) =>
  ({ Ordinal: index, SourceIndex: index, Values: [key(warehouse), key(organization), key(supplier)] })

function supplierPreview(dataSource: string) {
  return {
    Version: 1, ResultSha256: 'c'.repeat(64), PresentationOnly: true,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 3, ReturnedRows: 3, HasMore: false },
    Request: { DataSource: dataSource, IsCurrentSnapshot: false, ObservationStartedAtUtc: null,
      ObservationCompletedAtUtc: null, HasPeriod: true, PeriodFrom: '01.10.2026', PeriodTo: '31.10.2026',
      ComparisonPeriodFrom: null, ComparisonPeriodTo: null, RowGroupings: ['Склад продажу', 'Організація', 'Постачальник'], ColumnGroupings: [],
      Measures: ['Кількість'], Filters: [], IgnoredFilters: [], Notes: [] },
    RowSchema: [{ Caption: 'Склад продажу' }, { Caption: 'Організація' }, { Caption: 'Постачальник' }],
    ColumnSchema: [{ Caption: 'Показник' }],
    Rows: [row(0, 'СКЛАД -1', 'Фенікс', 'ALFA'), row(1, 'СКЛАД -3', 'Фенікс', 'ALFA'), row(2, 'СКЛАД -3', 'Фенікс', 'BETA')],
    Columns: [{ Ordinal: 0, SourceIndex: 0, Values: [{ Caption: 'Кількість', Identity: { Kind: 'reportField', Value: 'SalesQuantity', Provenance: 'columnAxisKey' } }] }],
    Cells: [{ RowSourceIndex: 0, ColumnSourceIndex: 0, Value: amount('1') }, { RowSourceIndex: 1, ColumnSourceIndex: 0, Value: amount('2') },
      { RowSourceIndex: 2, ColumnSourceIndex: 0, Value: amount('3') }],
    Totals: { State: 'materialized', Values: [total(-1, '6')], Groups: [
      { Level: 0, RowSourceIndex: 0, RowCount: 1, Values: [total(0, '1')] }, { Level: 1, RowSourceIndex: 0, RowCount: 1, Values: [total(0, '1')] },
      { Level: 0, RowSourceIndex: 1, RowCount: 2, Values: [total(1, '5')] }, { Level: 1, RowSourceIndex: 1, RowCount: 2, Values: [total(1, '5')] }] },
  }
}

const groupRows = (dataSource: string) => {
  render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: supplierPreview(dataSource) })} /></I18nProvider></MantineProvider>)
  return within(screen.getByRole('table')).getAllByRole('row').filter(tableRow => tableRow.classList.contains('report-inline-preview__group-total'))
}

describe('supplier gross profit group rows', () => {
  it('keep the parent group values in the parent columns like the 1C form', () => {
    const rows = groupRows('NativeSupplierGrossProfit')
    expect(rows.map(tableRow => within(tableRow).getAllByRole('rowheader').map(cell => cell.textContent))).toEqual([
      ['СКЛАД -1', '', ''], ['СКЛАД -1', 'Фенікс', ''], ['СКЛАД -3', '', ''], ['СКЛАД -3', 'Фенікс', '']])
    expect(rows.some(tableRow => tableRow.textContent?.includes('Підсумок'))).toBe(false)
  })
})
