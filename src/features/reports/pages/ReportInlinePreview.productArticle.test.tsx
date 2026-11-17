import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { ReportInlinePreview } from './ReportInlinePreview'

const request = {
  DataSource: 'NativeStockPeriod', IsCurrentSnapshot: false, ObservationStartedAtUtc: null, ObservationCompletedAtUtc: null,
  HasPeriod: true, PeriodFrom: '01.11.2026', PeriodTo: '17.11.2026', ComparisonPeriodFrom: null, ComparisonPeriodTo: null,
  RowGroupings: ['Склад', 'Товар', 'Документ надходження'], ColumnGroupings: [], Measures: ['Кількість'], Filters: [], IgnoredFilters: [], Notes: [],
}
const id = (value: string) => ({ Kind: 'signedInteger', Value: value, Provenance: 'rowAxisKey' })
const row = (index: number, product: string, productId: string, article: string, receipt: string) => ({
  Ordinal: index, SourceIndex: index, Values: [
    { Identity: id('2996'), Caption: 'Автопарк Конкорд' },
    { Identity: id(productId), Caption: product, Article: article },
    { Identity: id(String(900 + index)), Caption: receipt }],
})

function show(rows = [
  row(0, 'Фильтр масляный двигателя', '11', 'CE1059EX-SF', 'IHR2024000000037 від 22.02.2024'),
  row(1, 'Фильтр масляный двигателя', '12', 'CS1424-SF', 'IHR2025000000207 від 20.08.2025'),
  row(2, 'Фильтр топливный BOSCH', '13', '1457434294-BOSCH', '00000000042 від 14.10.2026'),
]) {
  const preview = normalizeNativeReportPreview({ Preview: {
    Version: 1, ResultSha256: 'b'.repeat(64), PresentationOnly: true, Request: request,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: rows.length, ReturnedRows: rows.length, HasMore: false },
    RowSchema: [{ Caption: 'Склад', Identity: 'StockWarehouse' }, { Caption: 'Товар', Identity: 'Product', ArticleCaption: 'Артикул' },
      { Caption: 'Документ надходження', Identity: 'PurchaseDocument' }],
    ColumnSchema: [{ Caption: 'Кількість' }], Rows: rows,
    Columns: [{ Ordinal: 0, SourceIndex: 0, Values: [{ Caption: 'Кількість' }] }],
    Cells: rows.map(item => ({ RowSourceIndex: item.SourceIndex, ColumnSourceIndex: 0, Value: { Kind: 'decimal', Value: '1', Provenance: 'producerCell' } })),
  } })
  return render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>)
}

it('prints the product name and its article in two columns right after «Товар»', () => {
  show()
  const table = screen.getByRole('table')
  expect(within(table).getAllByRole('columnheader').slice(0, 4).map(cell => cell.textContent))
    .toEqual(['Склад', 'Товар', 'Артикул', 'Документ надходження'])
  const body = within(table).getAllByRole('row').slice(1, 4)
  expect(body.map(item => within(item).getAllByRole('rowheader').map(cell => cell.textContent))).toEqual([
    ['Автопарк Конкорд', 'Фильтр масляный двигателя', 'CE1059EX-SF', 'IHR2024000000037 від 22.02.2024'],
    ['Автопарк Конкорд', 'Фильтр масляный двигателя', 'CS1424-SF', 'IHR2025000000207 від 20.08.2025'],
    ['Автопарк Конкорд', 'Фильтр топливный BOSCH', '1457434294-BOSCH', '00000000042 від 14.10.2026'],
  ])
  expect(table.textContent).not.toContain('(CE1059EX-SF)')
  expect(table.textContent).not.toMatch(/\[\d+\]/)
})

it('keeps a same-named product with another article as its own row, not a repeat', () => {
  show()
  const [, first, second] = within(screen.getByRole('table')).getAllByRole('row')
  expect(within(second).getAllByRole('rowheader')[1].className).not.toContain('is-repeat')
  expect(within(first).getAllByRole('rowheader')[1].className).not.toContain('is-repeat')
})

it('rejects an article that is not text', () => {
  expect(() => show([{ ...row(0, 'Фильтр', '11', 'A', 'Д'), Values: [{ Caption: 'Склад' }, { Caption: 'Фильтр', Article: 5 as unknown as string }, { Caption: 'Д' }] }]))
    .toThrow()
})
