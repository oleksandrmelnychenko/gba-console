import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { ReportInlinePreview } from './ReportInlinePreview'

// Presentation fixtures exercise caption/NULL rendering, not an accounting or price oracle.
// Identity/caption metadata copied from an actual source46 backend cache fixture; no monetary oracle is copied.
const currentAxisMetadata: Record<string, { Identity: string; Caption: string; DisplayKind: string; KeyKind: string; Captioned: boolean; AgreementRole: string }> = {
  "ProductDescription": {
    "Identity": "ProductDescription",
    "Caption": "Поточний опис товару",
    "DisplayKind": "Text",
    "KeyKind": "Text",
    "Captioned": false,
    "AgreementRole": "none"
  },
  "ProductTop": {
    "Identity": "ProductTop",
    "Caption": "Поточний TOP товару",
    "DisplayKind": "Text",
    "KeyKind": "Text",
    "Captioned": false,
    "AgreementRole": "none"
  },
  "Product": {
    "Identity": "Product",
    "Caption": "Товар",
    "DisplayKind": "Text",
    "KeyKind": "Numeric",
    "Captioned": true,
    "AgreementRole": "none"
  }
}
const scalar = (value: string | null, provenance = 'producerCell') => ({
  Kind: value === null ? 'null' : 'decimal', Value: value, Provenance: provenance,
})
const axisValue = (caption: string, identity: string | null = caption, kind?: string) => ({
  Caption: caption, Identity: { Kind: kind ?? (identity === null ? 'null' : 'text'), Value: identity, Provenance: 'rowAxisKey' },
})
const fields = [
  ['SalesQuantity', 'Кількість'], ['OneCSalesValueBeforeDiscount', 'До знижки'],
  ['OneCPriceTypeValue', 'За типом ціни'], ['OneCPriceTypeDifference', 'Різниця'],
]
function fixture(identity = 'ProductDescription', caption = 'Опис [123]', source = 'NativePriceComparison') {
  const rowSchema: Array<{ Identity?: string; Caption: string; DisplayKind?: string; KeyKind?: string; Captioned?: boolean }> = [{ ...currentAxisMetadata.Product }, { ...currentAxisMetadata[identity] }, { Identity: 'SaleDocument', Caption: 'Документ продажу' }]
  const row = { Ordinal: 0, SourceIndex: 0, Values: [axisValue('Товар [38242326]', '38242326', 'signedInteger'), axisValue(caption), axisValue('Продаж 0003 [2132458]', '2132458', 'signedInteger')] }
  const totals = (rowIndex: number) => fields.map((_, column) => ({ RowSourceIndex: rowIndex, ColumnSourceIndex: column,
    Value: scalar(column === 1 ? '66.00' : null, 'presentationTotal') }))
  return {
    Version: 1, ResultSha256: 'b'.repeat(64), PresentationOnly: true,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    Request: { DataSource: source, IsCurrentSnapshot: false, HasPeriod: true,
      PeriodFrom: '20.10.2026', PeriodTo: '20.10.2026', RowGroupings: rowSchema.map(item => item.Caption),
      ColumnGroupings: [] as string[], Measures: fields.map(item => item[1]), Filters: [], IgnoredFilters: [], Notes: [] },
    RowSchema: rowSchema, ColumnSchema: [{ Identity: '$measureGroup', Caption: 'Група' }, { Identity: '$measure', Caption: 'Показник' }],
    Rows: [row], Columns: fields.map(([identity, caption], index) => ({ Ordinal: index, SourceIndex: index,
      Values: [axisValue('Продажі'), { Caption: caption, Identity: { Kind: 'reportField', Value: identity, Provenance: 'columnAxisKey' } }] })),
    Cells: fields.map((_, index) => ({ RowSourceIndex: 0, ColumnSourceIndex: index, Value: scalar(index === 1 ? '66.00' : null) })),
    Totals: { State: 'materialized', Values: totals(-1), Groups: [0, 1].map(Level => ({ Level, RowSourceIndex: 0, RowCount: 1, Values: totals(0) })) },
  }
}
function show(wire: ReturnType<typeof fixture>) {
  return render(<MantineProvider env="test"><ReportInlinePreview preview={normalizeNativeReportPreview({ Preview: wire })} /></MantineProvider>)
}
const rawAxes = [['ProductDescription', 'Опис [123]'], ['ProductTop', 'TOP [456]']]
it.each(rawAxes)('preserves raw source46 %s suffix in leaf and subtotal while keeping money unknowns', (identity, caption) => {
  const view = show(fixture(identity, caption))
  expect(screen.getByRole('rowheader', { name: caption })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Підсумок: ' + caption })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Товар' })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Підсумок: Товар' })).toBeTruthy()
  expect(view.container.querySelector('tfoot th')?.textContent).toBe('Загальний підсумок')
  for (const row of view.container.querySelectorAll('tbody tr, tfoot tr')) {
    expect(within(row as HTMLElement).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['∅', '66,00', '∅', '∅'])
  }
})
it('retains source46 NULL and empty current attributes as separate axes without inventing a caption', () => {
  const wire = fixture()
  wire.Rows[0].Values[1] = axisValue('∅', null)
  wire.Rows.push({ Ordinal: 1, SourceIndex: 1, Values: [axisValue('Товар [38242326]', '38242326', 'signedInteger'), axisValue(''), axisValue('Продаж 0003 [2132458]', '2132458', 'signedInteger')] })
  wire.Page.TotalVisibleRows = wire.Page.ReturnedRows = 2
  show(wire)
  expect(screen.getByRole('rowheader', { name: '∅' })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Підсумок: ∅' })).toBeTruthy()
  const leaves = screen.getAllByRole('row').filter(row => row.closest('tbody') && !row.classList.contains('report-inline-preview__group-total'))
  expect(leaves.map(row => within(row).getAllByRole('rowheader')[1].textContent)).toEqual(['∅', ''])
})
it.each(rawAxes)('already preserves raw source46 %s column captions with NULL and empty members', (identity, caption) => {
  const wire = fixture(identity, caption)
  wire.RowSchema = [wire.RowSchema[0]]
  wire.Rows[0].Values = [wire.Rows[0].Values[0]]
  wire.Request.RowGroupings = ['Товар']
  wire.Request.ColumnGroupings = [identity === 'ProductTop' ? 'Поточний TOP товару' : 'Поточний опис товару']
  wire.ColumnSchema = [{ Identity: identity, Caption: wire.Request.ColumnGroupings[0] }, { Identity: '$measure', Caption: 'Показник' }]
  wire.Columns = [
    { Ordinal: 0, SourceIndex: 0, Values: [axisValue(caption), axisValue('Кількість')] },
    { Ordinal: 1, SourceIndex: 1, Values: [axisValue('∅', null), axisValue('До знижки')] },
    { Ordinal: 2, SourceIndex: 2, Values: [axisValue(''), axisValue('Різниця')] },
  ]
  wire.Cells = wire.Cells.slice(0, 3)
  wire.Totals.Groups = wire.Totals.Groups.slice(0, 1).map(group => ({ ...group, Values: group.Values.slice(0, 3) }))
  wire.Totals.Values = wire.Totals.Values.slice(0, 3)
  show(wire)
  expect(screen.getByRole('columnheader', { name: caption + ' / Кількість' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: '∅ / До знижки' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Різниця' })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Товар' })).toBeTruthy()
})
it('keeps decorated product, customer and document captions on the legacy source46 presentation path', () => {
  const wire = fixture()
  wire.RowSchema = [{ Identity: 'Product', Caption: 'Товар' }, { Identity: 'CustomerName', Caption: 'Клієнт' }, { Identity: 'SaleDocument', Caption: 'Документ продажу' }]
  wire.Rows[0].Values = [axisValue('Товар [38242326]', '38242326', 'signedInteger'), axisValue('Покупець [627051]', '627051', 'signedInteger'), axisValue('Продаж 0003 [2132458]', '2132458', 'signedInteger')]
  wire.Request.RowGroupings = wire.RowSchema.map(item => item.Caption)
  show(wire)
  expect(screen.getByRole('rowheader', { name: 'Товар' })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Покупець' })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Продаж 0003' })).toBeTruthy()
  expect(screen.queryByRole('rowheader', { name: 'Товар [38242326]' })).toBeNull()
})
it.each(rawAxes)('preserves audited typed raw source2 %s captions in leaf and subtotal', (identity, caption) => {
  const view = show(fixture(identity, caption, 'NativeSalesNet'))
  expect(screen.getByRole('rowheader', { name: caption })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Підсумок: ' + caption })).toBeTruthy()
  for (const row of view.container.querySelectorAll('tbody tr, tfoot tr'))
    expect(within(row as HTMLElement).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['∅', '66,00', '∅', '∅'])
})
const legacySource2Axes = rawAxes.flatMap(([identity, caption]) => ['missing', 'contradictory'].map(mode => [identity, caption, mode]))
it.each(legacySource2Axes)('keeps the source2 %s legacy caption path for %s with %s semantics', (identity, caption, mode) => {
  const wire = fixture(identity, caption, 'NativeSalesNet')
  wire.RowSchema[1] = mode === 'missing' ? { Identity: identity, Caption: wire.RowSchema[1].Caption }
    : { ...wire.RowSchema[1], Captioned: true, KeyKind: 'Numeric' }
  const view = show(wire)
  const oldCaption = caption.replace(/ \[\d+\]$/, '')
  expect(screen.getByRole('rowheader', { name: oldCaption })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Підсумок: ' + oldCaption })).toBeTruthy()
  expect(screen.queryByRole('rowheader', { name: caption })).toBeNull()
  for (const row of view.container.querySelectorAll('tbody tr, tfoot tr'))
    expect(within(row as HTMLElement).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['∅', '66,00', '∅', '∅'])
})
it.each(['missing', 'foreign'])('keeps the legacy caption path for a source46 %s schema identity', mode => {
  const wire = fixture()
  if (mode === 'missing') delete wire.RowSchema[1].Identity
  else wire.RowSchema[1] = { ...wire.RowSchema[1], Identity: 'UnknownFutureField' }
  show(wire)
  expect(screen.getByRole('rowheader', { name: 'Опис' })).toBeTruthy()
  expect(screen.getByRole('rowheader', { name: 'Підсумок: Опис' })).toBeTruthy()
  expect(screen.queryByRole('rowheader', { name: 'Опис [123]' })).toBeNull()
})
