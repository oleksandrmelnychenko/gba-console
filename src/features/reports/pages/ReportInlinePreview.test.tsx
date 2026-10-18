import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { normalizeNativeReportPreview, type NativeReportPreviewRequest } from '../data/nativeReportPreview'
import { ReportInlinePreview } from './ReportInlinePreview'

const request: NativeReportPreviewRequest = {
  DataSource: 'NativeDayOrganizationGrossProfit', IsCurrentSnapshot: false,
  ObservationStartedAtUtc: null, ObservationCompletedAtUtc: null,
  HasPeriod: true, PeriodFrom: '12.09.2026', PeriodTo: '12.09.2026', ComparisonPeriodFrom: null, ComparisonPeriodTo: null,
  RowGroupings: ['День', 'Організація'], ColumnGroupings: [], Measures: ['Сума'],
  Filters: [{ Field: 'Послуга Fenix', Condition: 'Дорівнює', Values: ['Ні'], IgnoredReason: null }],
  IgnoredFilters: [], Notes: [
    'Невідомі складові залишають залежні показники порожніми на всіх рівнях підсумків.',
    'Це частковий нативний варіант GBA; поля Артикул/Top та відповідність XLS 1С не підтверджені.',
    'Класифікацію Goods підтверджено тільки для повної множини чинних товарів продажу вибраного дня; повноту каталогу Fenix не стверджено.',
  ],
}
function show(Request: unknown = request, Value: unknown = { Kind: 'null', Value: null, Provenance: 'producerCell' }) {
  const preview = normalizeNativeReportPreview({ Preview: {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    RowSchema: [{ Caption: 'День' }], ColumnSchema: [{ Caption: 'Сума' }],
    Rows: [{ Ordinal: 0, SourceIndex: 12, Values: [{ Caption: '12.09.2026' }] }],
    Columns: [{ Ordinal: 0, SourceIndex: 3, Values: [{ Caption: 'Сума' }] }],
    Cells: [{ RowSourceIndex: 12, ColumnSourceIndex: 3, Value }],
  } })
  return render(<MantineProvider env="test"><ReportInlinePreview preview={preview} /></MantineProvider>)
}

it('shows the result without technical report descriptions or tutorials', () => {
  const view = show()
  expect(screen.queryByText('Про дані звіту')).toBeNull()
  expect(screen.queryByText('Як розраховано')).toBeNull()
  expect(screen.queryByText('Застосовані фільтри')).toBeNull()
  expect(screen.queryByText(/Період розрахунку:/)).toBeNull()
  for (const note of request.Notes!) expect(screen.queryByText(note)).toBeNull()
  expect(view.container.querySelector('details')).toBeNull()
  expect(view.container.textContent).not.toContain('NativeDayOrganizationGrossProfit')
  expect(view.container.textContent).not.toContain('a'.repeat(64))
  expect(screen.getByRole('cell', { name: '∅' })).toBeTruthy()
})

it('warns explicitly about ignored filters and their server reason', () => {
  show({ ...request, IgnoredFilters: [{ Field: 'Договір', Condition: 'Дорівнює', Values: ['Обраний договір'], IgnoredReason: 'Цей відбір не застосовано до результату.' }] })
  const warning = screen.getByRole('alert')
  expect(within(warning).getByText('Увага: фільтри не застосовано')).toBeTruthy()
  expect(within(warning).getByText('Договір Дорівнює: Обраний договір (Цей відбір не застосовано до результату.)')).toBeTruthy()
})

it('renders server HTML as text in ignored-filter warnings', () => {
  const html = '<img src=x onerror=alert(1)>'
  const view = show({ ...request, PeriodFrom: html, Notes: [html],
    IgnoredFilters: [{ Field: html, Condition: 'Дорівнює', Values: [html], IgnoredReason: html }] })
  expect(screen.getByRole('alert').textContent).toContain(html)
  expect(view.container.querySelectorAll('img,script')).toHaveLength(0)
  expect(view.container.textContent).not.toContain(`Період розрахунку: ${html}`)
})

it('keeps missing legacy attribution explicit rather than inventing dates or completeness', () => {
  show(null)
  expect(screen.getByText('Опис розрахунку відсутній')).toBeTruthy()
  expect(screen.queryByText(/Період розрахунку:/)).toBeNull()
  expect(screen.queryByText('Відборів немає.')).toBeNull()
})

it('keeps a missing ignored-filter list explicit without showing technical metadata', () => {
  show({ ...request, HasPeriod: false, Filters: null, IgnoredFilters: null, Notes: null })
  expect(screen.getByText('Відомості про незастосовані фільтри відсутні')).toBeTruthy()
  expect(screen.queryByText('Сервер не передав примітки до розрахунку.')).toBeNull()
  expect(screen.queryByText('Сервер не передав відомості про застосовані фільтри.')).toBeNull()
})

it('describes current stock only when the server marks it current', () => {
  const times = { ObservationStartedAtUtc: '2026-09-27T10:00:00.0000000Z', ObservationCompletedAtUtc: '2026-09-27T10:00:01.0000000Z' }
  const view = show({ ...request, ...times })
  expect(screen.queryByText('Поточний стан')).toBeNull()
  view.unmount()
  show({ ...request, ...times, IsCurrentSnapshot: true, HasPeriod: false })
  expect(screen.getByText('Поточний стан')).toBeTruthy()
  expect(screen.getByText('Дані прочитано: 27.09.2026 13:00')).toBeTruthy()
})

it('retains repeated ignored filters and hides exact technical identities', () => {
  const guid = '11111111222233334444555555555555'
  const view = show({ ...request, Notes: ['Повторена примітка', 'Повторена примітка'],
    IgnoredFilters: [0, 1].map(() => ({ Field: 'Вид товару Fenix', Condition: 'У списку', Values: [guid, '[Id=42]', 'Назва товару [Id=64]'], IgnoredReason: null })) })
  expect(screen.queryByText('Повторена примітка')).toBeNull()
  expect(view.container.textContent).not.toContain(guid)
  expect(view.container.textContent).not.toContain('[Id=42]')
  expect(view.container.textContent).not.toContain('[Id=64]')
  expect(screen.getAllByText('Вид товару Fenix У списку: Обране точне значення, Обране точне значення, Назва товару')).toHaveLength(2)
})

it('prints decimal cells with 1C thousands separators and a decimal comma', () => {
  show(request, { Kind: 'decimal', Value: '104090.44', Provenance: 'producerCell' })
  const table = screen.getByRole('region', { name: 'Таблиця попереднього перегляду' })
  expect(table.querySelector('td')?.textContent).toBe('104\u00a0090,44')
})

it('shows the workbook names without technical ids, money with two decimals and one shared column group once', () => {
  const preview = normalizeNativeReportPreview({ Preview: {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: request,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    RowSchema: [{ Caption: 'Дата' }, { Caption: 'Організація' }], ColumnSchema: [{ Caption: 'Група' }, { Caption: 'Показник' }],
    Rows: [{ Ordinal: 0, SourceIndex: 1, Values: [{ Caption: '01.09.2026' }, { Caption: 'ТОВ «АМГ «КОНКОРД» [10557]' }] }],
    Columns: [
      { Ordinal: 0, SourceIndex: 0, Values: [{ Caption: 'Валовий прибуток' }, { Caption: 'Продажі без ПДВ, EUR',
        Identity: { Kind: 'reportField', Value: 'SalesValueWithoutVAT', Provenance: 'columnAxisKey' } }] },
      { Ordinal: 1, SourceIndex: 1, Values: [{ Caption: 'Валовий прибуток' }, { Caption: 'Кількість',
        Identity: { Kind: 'reportField', Value: 'SalesQuantity', Provenance: 'columnAxisKey' } }] },
    ],
    Cells: [{ RowSourceIndex: 1, ColumnSourceIndex: 0, Value: { Kind: 'decimal', Value: '2260.3', Provenance: 'producerCell' } },
      { RowSourceIndex: 1, ColumnSourceIndex: 1, Value: { Kind: 'decimal', Value: '3527', Provenance: 'producerCell' } }],
  } })
  render(<MantineProvider env="test"><ReportInlinePreview preview={preview} /></MantineProvider>)
  const table = within(screen.getByRole('region', { name: 'Таблиця попереднього перегляду' }))
  expect(table.getByRole('rowheader', { name: 'ТОВ «АМГ «КОНКОРД»' })).toBeTruthy()
  expect(table.getByRole('columnheader', { name: 'Продажі без ПДВ, EUR' })).toBeTruthy()
  expect(table.getByRole('cell', { name: '2\u00a0260,30' })).toBeTruthy()
  expect(table.getByRole('cell', { name: '3\u00a0527' })).toBeTruthy()
})
