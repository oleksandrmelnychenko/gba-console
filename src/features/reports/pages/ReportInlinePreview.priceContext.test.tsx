import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { ReportInlinePreview } from './ReportInlinePreview'

// Authored presentation compatibility examples, NOT actual SQL/HTTP or accounting receipts.
const descriptor = (Identity: string, KeyKind: string) => ({ Identity, Caption: Identity, Captioned: true, KeyKind, DisplayKind: 'Text' })
const axisValue = (caption: string, key: string | null, kind = key === null ? 'null' : 'signedInteger', provenance = 'rowAxisKey') =>
  ({ Caption: caption, Identity: { Kind: kind, Value: key, Provenance: provenance } })
const fields = [['SalesQuantity', 'Кількість'], ['SalesValueWithoutVAT', 'Продажі без ПДВ'], ['OneCPriceTypeValue', 'За типом ціни'], ['OneCPriceTypeDifference', 'Різниця']]
const value = (raw: string | null) => ({ Kind: raw === null ? 'null' : 'decimal', Value: raw, Provenance: 'presentationExample' })
function fixture(identity = 'SaleDocumentManagerPosted', kind = 'Numeric', caption = 'Poster [2025]', key: string | null = '9007199254740993') {
  const schema = descriptor(identity, kind)
  const rowValues = [axisValue(caption, key, key === null ? 'null' : kind === 'Text' ? 'text' : 'signedInteger'), axisValue('Товар', '38242326')]
  const cells = (row: number) => fields.map((_, column) => ({ RowSourceIndex: row, ColumnSourceIndex: column, Value: value(column === 1 ? '66.00' : null) }))
  return {
    Version: 1, ResultSha256: 'b'.repeat(64), PresentationOnly: true,
    Page: { Offset: 0, Limit: 1, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    Request: { DataSource: 'NativePriceComparison', IsCurrentSnapshot: false, HasPeriod: true, PeriodFrom: '20.10.2026', PeriodTo: '20.10.2026',
      RowGroupings: [schema.Caption, 'Товар'], ColumnGroupings: [] as string[], Measures: fields.map(field => field[1]), Filters: [], IgnoredFilters: [], Notes: [] },
    RowSchema: [schema, descriptor('Product', 'Numeric')],
    ColumnSchema: [{ Identity: '$measureGroup', Caption: 'Група' }, { Identity: '$measure', Caption: 'Показник' }],
    Rows: [{ Ordinal: 0, SourceIndex: 0, Values: rowValues }],
    Columns: fields.map(([field, caption], index) => ({ Ordinal: index, SourceIndex: index, Values: [axisValue('Продажі', 'Продажі', 'text', 'columnAxisKey'), axisValue(caption, field, 'reportField', 'columnAxisKey')] })),
    Cells: cells(0), Totals: { State: 'materialized', Values: cells(-1), Groups: [{ Level: 0, RowSourceIndex: 0, RowCount: 1, Values: cells(0) }] },
  }
}
function show(wire: ReturnType<typeof fixture>) {
  const preview = normalizeNativeReportPreview({ Preview: wire })
  return { ...render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>), preview }
}
function expectMoneyAndUnknowns(container: HTMLElement) {
  for (const row of container.querySelectorAll('tbody tr, tfoot tr'))
    expect(within(row as HTMLElement).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['—', '66,00', '—', '—'])
}
it('preserves a real business numeric tail on the supplied posting-user row and subtotal while all money/unknowns remain exact', () => {
  const wire=fixture(),before=structuredClone(wire),view=show(wire)
  expect(screen.getByRole('rowheader',{name:'Poster [2025]'})).toBeTruthy()
  expect(screen.getByRole('rowheader',{name:'Підсумок: Poster [2025]'})).toBeTruthy()
  expect(view.preview.Rows[0].Values[0].Identity?.Value).toBe('9007199254740993')
  expect(view.preview.Cells).toEqual(before.Cells);expect(view.preview.Totals).toEqual(before.Totals);expect(wire).toEqual(before)
  expectMoneyAndUnknowns(view.container)
})
it('retains same-name posting-user IDs on actual-shaped independent one-row pages', () => {
  const first=fixture('SaleDocumentManagerPosted','Numeric','Twin [9007199254740993]','9007199254740993');first.Page.TotalVisibleRows=2;first.Page.HasMore=true
  const view=show(first);expect(screen.getByRole('rowheader',{name:'Twin [9007199254740993]'})).toBeTruthy()
  const next=fixture('SaleDocumentManagerPosted','Numeric','Twin [9223372036854775807]','9223372036854775807');next.Page.Offset=1;next.Page.TotalVisibleRows=2
  next.Rows[0].Ordinal=next.Rows[0].SourceIndex=1;next.Cells.forEach(cell=>{cell.RowSourceIndex=1});next.Totals.Groups[0].RowSourceIndex=1;next.Totals.Groups[0].Values.forEach(cell=>{cell.RowSourceIndex=1})
  const preview=normalizeNativeReportPreview({Preview:next});view.rerender(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview}/></I18nProvider></MantineProvider>)
  expect(screen.getByRole('rowheader',{name:'Twin [9223372036854775807]'})).toBeTruthy();expect(screen.queryByRole('rowheader',{name:'Twin [9007199254740993]'})).toBeNull()
  expect(preview.Rows[0].Values[0].Identity?.Value).toBe('9223372036854775807');expectMoneyAndUnknowns(view.container)
})
it('uses the same supplied posting caption in columns without interpreting its Int64 key', () => {
  const wire=fixture();wire.RowSchema=[descriptor('Product','Numeric')];wire.Rows[0].Values=[wire.Rows[0].Values[1]];wire.Request.RowGroupings=['Товар'];wire.Request.ColumnGroupings=['Користувач проведення']
  wire.ColumnSchema=[descriptor('SaleDocumentManagerPosted','Numeric'),{Identity:'$measure',Caption:'Показник'}]
  wire.Columns.forEach(column=>{column.Values[0]=axisValue('Poster [2025]','9007199254740993','signedInteger','columnAxisKey')});wire.Totals.Groups=[]
  const view=show(wire);expect(screen.getByRole('columnheader',{name:'Poster [2025] / Продажі без ПДВ'})).toBeTruthy();expect(view.preview.Columns[0].Values[0].Identity?.Value).toBe('9007199254740993');expectMoneyAndUnknowns(view.container)
})
it('does not invent a posting-user name for a missing original-parent NULL bucket', () => {
  const wire=fixture('SaleDocumentManagerPosted','Numeric','∅',null),view=show(wire)
  expect(view.preview.Rows[0].Values[0].Identity?.Kind).toBe('null');expect(view.preview.Rows[0].Values[0].Identity?.Value).toBeNull()
  expect(screen.getByRole('rowheader',{name:'∅'})).toBeTruthy();expectMoneyAndUnknowns(view.container)
})
it('retains existing source2 caption cleanup for the same explicit numeric posting metadata', () => {
  const wire=fixture();wire.Request.DataSource='NativeSalesNet';const view=show(wire)
  expect(screen.getByRole('rowheader',{name:'Poster'})).toBeTruthy();expect(screen.getByRole('rowheader',{name:'Підсумок: Poster'})).toBeTruthy();expectMoneyAndUnknowns(view.container)
})
