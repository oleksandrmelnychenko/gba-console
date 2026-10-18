import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { isZeroPreviewScalar, normalizeNativeReportPreview, previewBlanksZero } from '../data/nativeReportPreview'
import { ReportInlinePreview } from './ReportInlinePreview'

const amount = (value: string | null) => value === null
  ? { Kind: 'null', Value: null, Provenance: 'producerCell' } : { Kind: 'decimal', Value: value, Provenance: 'producerCell' }
const total = (row: number, column: number, value: string | null) =>
  ({ RowSourceIndex: row, ColumnSourceIndex: column, Value: { ...amount(value), Provenance: 'presentationTotal' } })
const row = (index: number, organization: string, party: string) => ({ Ordinal: index, SourceIndex: index,
  Values: [{ Caption: organization, Identity: { Kind: 'text', Value: organization, Provenance: 'rowAxisKey' } },
    { Caption: party, Identity: { Kind: 'text', Value: party, Provenance: 'rowAxisKey' } }] })
const column = (index: number, field: string, caption: string) => ({ Ordinal: index, SourceIndex: index,
  Values: [{ Caption: 'Сума взаєморозрахунків' }, { Caption: caption, Identity: { Kind: 'reportField', Value: field, Provenance: 'columnAxisKey' } }] })

function settlementPreview(totals: unknown) {
  return {
    Version: 1, ResultSha256: 'b'.repeat(64), PresentationOnly: true,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 3, ReturnedRows: 3, HasMore: false },
    Request: { DataSource: 'NativeSettlementPeriod', IsCurrentSnapshot: false, ObservationStartedAtUtc: null,
      ObservationCompletedAtUtc: null, HasPeriod: true, PeriodFrom: '01.09.2026', PeriodTo: '30.09.2026',
      ComparisonPeriodFrom: null, ComparisonPeriodTo: null, RowGroupings: ['Організація', 'Контрагент'], ColumnGroupings: [],
      Measures: ['Поч. залишок', 'Видаток'], Filters: [], IgnoredFilters: [], Notes: [] },
    RowSchema: [{ Caption: 'Організація' }, { Caption: 'Контрагент' }], ColumnSchema: [{ Caption: 'Група показників' }, { Caption: 'Показник' }],
    Rows: [row(0, 'Фенікс', 'Скляр'), row(1, 'Фенікс', 'Скляр (постачальник)'), row(2, 'ФОП Самолюк', 'АБІКС ТОВ')],
    Columns: [column(0, 'SettlementPeriodOpening', 'Поч. залишок'), column(1, 'SettlementPeriodOutgoing', 'Видаток')],
    Cells: [{ RowSourceIndex: 0, ColumnSourceIndex: 0, Value: amount('10.5') }, { RowSourceIndex: 0, ColumnSourceIndex: 1, Value: amount('0.00') },
      { RowSourceIndex: 1, ColumnSourceIndex: 0, Value: amount('-3') }, { RowSourceIndex: 1, ColumnSourceIndex: 1, Value: amount(null) },
      { RowSourceIndex: 2, ColumnSourceIndex: 0, Value: amount('0') }, { RowSourceIndex: 2, ColumnSourceIndex: 1, Value: amount('4') }],
    Totals: totals,
  }
}

const materialized = {
  State: 'materialized',
  Values: [total(-1, 0, '7.5'), total(-1, 1, null)],
  Groups: [{ Level: 0, RowSourceIndex: 0, RowCount: 2, Values: [total(0, 0, '7.5'), total(0, 1, null)] },
    { Level: 0, RowSourceIndex: 2, RowCount: 1, Values: [total(2, 0, '0'), total(2, 1, '4')] }],
}

describe('1C-like totals and blank zeros in the report preview', () => {
  it('prints each group total above its rows and the grand total at the bottom, with zeros blank and unknown sums ∅', () => {
    const view = render(<MantineProvider env="test"><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: settlementPreview(materialized) })} /></MantineProvider>)
    const table = screen.getByRole('table')
    const bodyRows = within(table).getAllByRole('row').filter(tableRow => tableRow.closest('tbody'))
    expect(bodyRows.map(tableRow => tableRow.textContent)).toEqual([
      'Підсумок: Фенікс7,50∅', 'ФеніксСкляр10,50', 'ФеніксСкляр (постачальник)-3,00∅', 'Підсумок: ФОП Самолюк4,00', 'ФОП СамолюкАБІКС ТОВ4,00'])
    const footer = view.container.querySelector('tfoot tr')
    expect(footer?.textContent).toBe('Загальний підсумок7,50∅')
    expect(within(table).queryByRole('cell', { name: '0,00' })).toBeNull()
    expect(view.container.textContent).not.toContain('На екрані показано рядки без підсумків')
  })

  it('does not invent totals when the server did not materialize them', () => {
    const view = render(<MantineProvider env="test"><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: settlementPreview({ State: 'notMaterialized', Values: [] }) })} /></MantineProvider>)
    expect(view.container.querySelector('tfoot')).toBeNull()
  })

  it('rejects totals that do not belong to the returned page', () => {
    expect(() => normalizeNativeReportPreview({ Preview: settlementPreview({ ...materialized,
      Groups: [{ Level: 0, RowSourceIndex: 9, RowCount: 1, Values: [] }] }) })).toThrow()
    expect(() => normalizeNativeReportPreview({ Preview: settlementPreview({ ...materialized,
      Values: [total(0, 0, '1')] }) })).toThrow()
    expect(() => normalizeNativeReportPreview({ Preview: settlementPreview({ ...materialized,
      Values: [total(-1, 7, '1')] }) })).toThrow()
  })

  it('blanks only exact zeros and only for the 1C workbook datasets', () => {
    expect(['0', '0.00', '-0', '0.000'].every(value => isZeroPreviewScalar(amount(value)))).toBe(true)
    expect(['0.01', '-0.004', '10'].some(value => isZeroPreviewScalar(amount(value)))).toBe(false)
    expect(isZeroPreviewScalar(amount(null))).toBe(false)
    expect(isZeroPreviewScalar({ Kind: 'text', Value: '0', Provenance: 'producerCell' })).toBe(false)
    expect(['NativeDayOrganizationGrossProfit', 'NativeSupplierGrossProfit', 'NativeCurrentVparivanie', 'NativeCashPeriod',
      'NativeSettlementPeriod'].every(previewBlanksZero)).toBe(true)
    expect(previewBlanksZero('NativeSalesNet')).toBe(false)
    expect(previewBlanksZero(undefined)).toBe(false)
  })
})
