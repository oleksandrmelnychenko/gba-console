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
function show(Request: unknown = request) {
  const preview = normalizeNativeReportPreview({ Preview: {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    RowSchema: [{ Caption: 'День' }], ColumnSchema: [{ Caption: 'Сума' }],
    Rows: [{ Ordinal: 0, SourceIndex: 12, Values: [{ Caption: '12.09.2026' }] }],
    Columns: [{ Ordinal: 0, SourceIndex: 3, Values: [{ Caption: 'Сума' }] }],
    Cells: [{ RowSourceIndex: 12, ColumnSourceIndex: 3, Value: { Kind: 'null', Value: null, Provenance: 'producerCell' } }],
  } })
  return render(<MantineProvider env="test"><ReportInlinePreview preview={preview} /></MantineProvider>)
}

it('shows actual display period and real dataset35 coverage notes without hidden disclosure', () => {
  const view = show()
  const about = within(screen.getByRole('region', { name: 'Про дані звіту' }))
  expect(about.getByText('Період розрахунку: 12.09.2026 — 12.09.2026')).toBeTruthy()
  for (const note of request.Notes!) expect(about.getByText(note)).toBeTruthy()
  expect(about.getByText('Послуга Fenix Дорівнює: Ні')).toBeTruthy()
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

it('renders server HTML as text in notes, periods and filter descriptions', () => {
  const html = '<img src=x onerror=alert(1)>'
  const view = show({ ...request, PeriodFrom: html, Notes: [html],
    IgnoredFilters: [{ Field: html, Condition: 'Дорівнює', Values: [html], IgnoredReason: html }] })
  expect(screen.getByText(html)).toBeTruthy()
  expect(view.container.querySelectorAll('img,script')).toHaveLength(0)
  expect(view.container.textContent).toContain(`Період розрахунку: ${html} — 12.09.2026`)
})

it('keeps missing legacy attribution explicit rather than inventing dates or completeness', () => {
  show(null)
  expect(screen.getByText('Опис розрахунку відсутній')).toBeTruthy()
  expect(screen.queryByText(/Період розрахунку:/)).toBeNull()
  expect(screen.queryByText('Сервер не зазначив застосованих фільтрів.')).toBeNull()
})

it('distinguishes unknown lists from explicit empty lists', () => {
  show({ ...request, HasPeriod: false, Filters: null, IgnoredFilters: null, Notes: null })
  expect(screen.getByText('Період розрахунку сервер не зазначив.')).toBeTruthy()
  expect(screen.getByText('Сервер не передав відомості про застосовані фільтри.')).toBeTruthy()
  expect(screen.getByText('Відомості про незастосовані фільтри відсутні')).toBeTruthy()
  expect(screen.getByText('Сервер не передав примітки до розрахунку.')).toBeTruthy()
  expect(screen.queryByText('Додаткових приміток сервера немає.')).toBeNull()
})

it('describes current stock only when the server marks it current', () => {
  const times = { ObservationStartedAtUtc: '2026-09-27T10:00:00.0000000Z', ObservationCompletedAtUtc: '2026-09-27T10:00:01.0000000Z' }
  const view = show({ ...request, ...times })
  expect(screen.queryByText('Поточний стан')).toBeNull()
  view.unmount()
  show({ ...request, ...times, IsCurrentSnapshot: true, HasPeriod: false })
  expect(screen.getByText('Поточний стан')).toBeTruthy()
  expect(screen.getByText(`Спостереження сервера: ${times.ObservationStartedAtUtc} — ${times.ObservationCompletedAtUtc}`)).toBeTruthy()
})

it('retains repeated notes and hides exact technical filter identities by default', () => {
  const guid = '11111111222233334444555555555555'
  const view = show({ ...request, Notes: ['Повторена примітка', 'Повторена примітка'],
    Filters: [{ Field: 'Вид товару Fenix', Condition: 'У списку', Values: [guid, '[Id=42]', 'Назва товару [Id=64]'], IgnoredReason: null }] })
  expect(screen.getAllByText('Повторена примітка')).toHaveLength(2)
  expect(view.container.textContent).not.toContain(guid)
  expect(view.container.textContent).not.toContain('[Id=42]')
  expect(view.container.textContent).not.toContain('[Id=64]')
  expect(screen.getByText('Вид товару Fenix У списку: Обране точне значення, Обране точне значення, Назва товару')).toBeTruthy()
})
