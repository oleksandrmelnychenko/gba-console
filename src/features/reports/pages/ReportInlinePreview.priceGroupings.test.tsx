import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { ReportInlinePreview } from './ReportInlinePreview'

// Authored presentation compatibility examples, NOT actual SQL/HTTP or accounting receipts.
const axes = [
  ['ProductGroup', 'Text'], ['CustomerRegion', 'Numeric'], ['CustomerRegionCode', 'Numeric'],
  ['CustomerManager', 'Numeric'], ['SaleReturnDocument', 'Numeric'],
] as const
const descriptor = (Identity: string, KeyKind: string) => ({ Identity, Caption: Identity, Captioned: true, KeyKind, DisplayKind: 'Text' })
const axisValue = (caption: string, key: string | null, kind = key === null ? 'null' : 'signedInteger', provenance = 'rowAxisKey') =>
  ({ Caption: caption, Identity: { Kind: kind, Value: key, Provenance: provenance } })
const fields = [['SalesQuantity', 'Кількість'], ['SalesValueWithoutVAT', 'Продажі без ПДВ'], ['OneCPriceTypeValue', 'За типом ціни'], ['OneCPriceTypeDifference', 'Різниця']]
const value = (raw: string | null) => ({ Kind: raw === null ? 'null' : 'decimal', Value: raw, Provenance: 'presentationExample' })
function fixture(identity = 'ProductGroup', kind = 'Text', caption = 'A + B [2025]', key: string | null = '["2","10"]') {
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
    expect(within(row as HTMLElement).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['∅', '66,00', '∅', '∅'])
}
it.each(axes)('keeps source46 %s supplied business brackets in the leaf and subtotal', (identity, kind) => {
  const caption = 'Бізнес [2025]', key = kind === 'Text' ? '["2","10"]' : '9007199254740993'
  const view = show(fixture(identity, kind, caption, key))
  expect(screen.getByRole('rowheader', { name: caption })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Підсумок: ' + caption })).toBeTruthy()
  expect(view.preview.Rows[0].Values[0].Identity?.Value).toBe(key)
  expectMoneyAndUnknowns(view.container)
})
it.each(axes.filter(([identity]) => identity !== 'ProductGroup'))('keeps source46 %s same-name exact identities on independent one-row pages', (identity, kind) => {
  const captions = ['Однакова назва [9007199254740993]', 'Однакова назва [9223372036854775807]']
  const first = fixture(identity, kind, captions[0], '9007199254740993')
  first.Page.TotalVisibleRows = 2; first.Page.HasMore = true
  const view = show(first)
  expect(screen.getByRole('rowheader', { name: captions[0] })).toBeTruthy()
  const second = fixture(identity, kind, captions[1], '9223372036854775807')
  second.Page.Offset = 1; second.Page.TotalVisibleRows = 2
  second.Rows[0].Ordinal = second.Rows[0].SourceIndex = 1
  second.Cells.forEach(cell => { cell.RowSourceIndex = 1 })
  second.Totals.Groups[0].RowSourceIndex = 1
  second.Totals.Groups[0].Values.forEach(cell => { cell.RowSourceIndex = 1 })
  const preview = normalizeNativeReportPreview({ Preview: second })
  view.rerender(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>)
  expect(screen.getByRole('rowheader', { name: captions[1] })).toBeTruthy()
  expect(screen.queryByRole('rowheader', { name: captions[0] })).toBeNull()
  expect(preview.Rows[0].Values[0].Identity?.Value).toBe('9223372036854775807')
  expectMoneyAndUnknowns(view.container)
})
it('keeps the canonical full-set identity separate from its current business caption', () => {
  const key = '["2","10","9007199254740993","9223372036854775807"]'
  const caption = 'A [2025] + B (групи ID: 2, 10, 9007199254740993, 9223372036854775807)'
  const view = show(fixture('ProductGroup', 'Text', caption, key))
  expect(view.preview.Rows[0].Values[0].Identity).toEqual({ Kind: 'text', Value: key, Provenance: 'rowAxisKey' })
  expect(screen.getByRole('rowheader', { name: caption })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Підсумок: ' + caption })).toBeTruthy()
  expect(view.container.textContent).not.toContain(key)
  expectMoneyAndUnknowns(view.container)
})
it.each(axes)('renders source46 %s columns using the same supplied caption without interpreting the key', (identity, kind) => {
  const caption = 'Бізнес [2025]', key = kind === 'Text' ? '["2","10"]' : '9007199254740993'
  const wire = fixture(identity, kind, caption, key)
  wire.RowSchema = [descriptor('Product', 'Numeric')];wire.Rows[0].Values = [wire.Rows[0].Values[1]]
  wire.Request.RowGroupings = ['Товар'];wire.Request.ColumnGroupings = [identity]
  wire.ColumnSchema = [descriptor(identity, kind), { Identity: '$measure', Caption: 'Показник' }]
  wire.Columns.forEach(column => { column.Values[0] = axisValue(caption, key, kind === 'Text' ? 'text' : 'signedInteger', 'columnAxisKey') })
  wire.Totals.Groups = []
  const view = show(wire)
  expect(screen.getByRole('columnheader', { name: caption + ' / Кількість' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: caption + ' / Продажі без ПДВ' })).toBeTruthy()
  expect(view.preview.Columns[0].Values[0].Identity?.Value).toBe(key)
  expectMoneyAndUnknowns(view.container)
})
it('keeps the own-return NULL sales bucket and two own returns as distinct rows with exact keys', () => {
  const wire = fixture('SaleReturnDocument', 'Numeric', 'Продажі', null)
  wire.Page.Limit = 3;wire.Page.TotalVisibleRows = wire.Page.ReturnedRows = 3
  wire.Rows.push(
    { Ordinal: 1, SourceIndex: 1, Values: [axisValue('Повернення [9007199254740993]', '9007199254740993'), axisValue('Товар', '38242326')] },
    { Ordinal: 2, SourceIndex: 2, Values: [axisValue('Повернення [9223372036854775807]', '9223372036854775807'), axisValue('Товар', '38242326')] })
  const first = [...wire.Cells]
  wire.Cells.push(...[1, 2].flatMap(row => first.map(cell => ({ ...cell, RowSourceIndex: row, Value: value(cell.ColumnSourceIndex === 1 ? row === 1 ? '-26.00' : '-40.00' : null) }))))
  wire.Totals.Values[1].Value = value('0.00')
  wire.Totals.Groups = []
  const view = show(wire)
  for (const caption of ['Продажі', 'Повернення [9007199254740993]', 'Повернення [9223372036854775807]'])
    expect(screen.getByRole('rowheader', { name: caption })).toBeTruthy()
  expect(view.preview.Rows.map(row => row.Values[0].Identity?.Value)).toEqual([null, '9007199254740993', '9223372036854775807'])
  expect(view.container.querySelectorAll('tbody tr')).toHaveLength(3)
  const leaves = Array.from(view.container.querySelectorAll('tbody tr'))
  expect(leaves.map(row => within(row as HTMLElement).getAllByRole('cell').map(cell => cell.textContent))).toEqual([
    ['∅', '66,00', '∅', '∅'], ['∅', '-26,00', '∅', '∅'], ['∅', '-40,00', '∅', '∅']])
  expect(within(view.container.querySelector('tfoot tr') as HTMLElement).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['∅', '0,00', '∅', '∅'])
})
it('keeps NULL sales and separate own-return members in columns without merging captioned keys', () => {
  const wire = fixture('SaleReturnDocument', 'Numeric', 'Продажі', null)
  wire.RowSchema = [descriptor('Product', 'Numeric')];wire.Rows[0].Values = [wire.Rows[0].Values[1]]
  wire.Request.RowGroupings = ['Товар'];wire.Request.ColumnGroupings = ['SaleReturnDocument']
  wire.ColumnSchema = [descriptor('SaleReturnDocument', 'Numeric'), { Identity: '$measure', Caption: 'Показник' }]
  const members = [
    { caption: 'Продажі', key: null, money: '66.00' },
    { caption: 'Повернення [9007199254740993]', key: '9007199254740993', money: '-26.00' },
    { caption: 'Повернення [9223372036854775807]', key: '9223372036854775807', money: '-40.00' },
  ]
  wire.Columns = members.flatMap((member, memberIndex) => fields.map(([field, caption], fieldIndex) => ({
    Ordinal: memberIndex * fields.length + fieldIndex, SourceIndex: memberIndex * fields.length + fieldIndex,
    Values: [axisValue(member.caption, member.key, member.key === null ? 'null' : 'signedInteger', 'columnAxisKey'), axisValue(caption, field, 'reportField', 'columnAxisKey')] })))
  wire.Cells = wire.Columns.map(column => ({ RowSourceIndex: 0, ColumnSourceIndex: column.SourceIndex,
    Value: value(column.SourceIndex % fields.length === 1 ? members[Math.floor(column.SourceIndex / fields.length)].money : null) }))
  wire.Totals.Values = wire.Cells.map(cell => ({ ...cell, RowSourceIndex: -1 }));wire.Totals.Groups = []
  const view = show(wire)
  for (const member of members)
    expect(screen.getByRole('columnheader', { name: member.caption + ' / Продажі без ПДВ' })).toBeTruthy()
  expect(view.preview.Columns.filter((_, index) => index % fields.length === 0).map(column => column.Values[0].Identity?.Value))
    .toEqual([null, '9007199254740993', '9223372036854775807'])
  expect(view.container.querySelectorAll('tbody td')).toHaveLength(12)
})
it('preserves the supplied source2 complete-set text caption and independent money under the new typed contract', () => {
  const wire = fixture();wire.Request.DataSource = 'NativeSalesNet'
  const view = show(wire)
  expect(screen.getByRole('rowheader', { name: 'A + B [2025]' })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Підсумок: A + B [2025]' })).toBeTruthy()
  expectMoneyAndUnknowns(view.container)
  view.unmount()
  // Existing generic source2 raw text remains raw when explicitly Captioned=false.
  const rawWire = fixture();rawWire.Request.DataSource = 'NativeSalesNet';rawWire.RowSchema[0].Captioned = false
  const raw = show(rawWire)
  expect(screen.getByRole('rowheader', { name: 'A + B [2025]' })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Підсумок: A + B [2025]' })).toBeTruthy()
  expectMoneyAndUnknowns(raw.container)
  raw.unmount()
  // Missing semantics retain the established cleanup path rather than inferring a set contract.
  const missingWire = fixture();missingWire.Request.DataSource = 'NativeSalesNet'
  Reflect.deleteProperty(missingWire.RowSchema[0], 'Captioned')
  const missing = show(missingWire)
  expect(screen.getByRole('rowheader', { name: 'A + B' })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Підсумок: A + B' })).toBeTruthy()
  expectMoneyAndUnknowns(missing.container)
})
