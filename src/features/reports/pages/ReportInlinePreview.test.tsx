import { I18nProvider } from '../../../shared/i18n/I18nProvider'
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
  return render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>)
}

it('shows the result with the server notes and without technical report descriptions', () => {
  const view = show()
  expect(screen.queryByText('Про дані звіту')).toBeNull()
  expect(screen.queryByText('Як розраховано')).toBeNull()
  expect(screen.queryByText('Застосовані фільтри')).toBeNull()
  expect(screen.queryByText(/Період розрахунку:/)).toBeNull()
  const notes = within(screen.getByRole('complementary', { name: 'Примітки до звіту' }))
  for (const note of request.Notes!) expect(notes.getByText(note)).toBeTruthy()
  expect(view.container.querySelector('details')).toBeNull()
  expect(view.container.textContent).not.toContain('NativeDayOrganizationGrossProfit')
  expect(view.container.textContent).not.toContain('a'.repeat(64))
  expect(screen.getByTitle('Значення не визначено.').textContent).toBe('—')
})

it('warns explicitly about ignored filters and their server reason', () => {
  show({ ...request, IgnoredFilters: [{ Field: 'Договір', Condition: 'Дорівнює', Values: ['Обраний договір'], IgnoredReason: 'Цей відбір не застосовано до результату.' }] })
  const warning = screen.getByRole('alert')
  expect(within(warning).getByText('Увага: фільтри не застосовано')).toBeTruthy()
  expect(within(warning).getByText('Договір Дорівнює: Обраний договір (Цей відбір не застосовано до результату.)')).toBeTruthy()
})

it('shows the returns note once in its own warning and the other notes in the notes block', () => {
  const gap = 'Повернень без підтвердженого первинного продажу в GBA: 1 (рядків: 1), сума 1.22 EUR з ПДВ. Їх не віднесено до жодного менеджера первинного продажу, тому до цього відбору вони не входять і звіт не блокують; у звіті без відбору вони показані в групі «Не вказано».'
  show({ ...request, Notes: [...request.Notes!, gap] })
  const warning = screen.getByRole('alert')
  expect(within(warning).getByText('Частину повернень не віднесено до первинного продажу')).toBeTruthy()
  expect(within(warning).getByText(gap)).toBeTruthy()
  expect(screen.getAllByText(gap)).toHaveLength(1)
  const notes = within(screen.getByRole('complementary', { name: 'Примітки до звіту' }))
  for (const note of request.Notes!) expect(notes.getByText(note)).toBeTruthy()
  expect(notes.queryByText(gap)).toBeNull()
  expect(screen.getByText('12.09.2026')).toBeTruthy()
})

it('renders server HTML as text in ignored-filter warnings', () => {
  const html = '<img src=x onerror=alert(1)>'
  const view = show({ ...request, PeriodFrom: html, Notes: [html],
    IgnoredFilters: [{ Field: html, Condition: 'Дорівнює', Values: [html], IgnoredReason: html }] })
  expect(screen.getByRole('alert').textContent).toContain(html)
  expect(view.container.querySelectorAll('img,script')).toHaveLength(0)
  expect(view.container.textContent).not.toContain(`Період розрахунку: ${html}`)
})

it('shows the server explanation of profit and quantity as plain text and folds notes beyond three', () => {
  const unshipped = 'Продажі GBA без відвантаження не враховано в собівартості та прибутку: 10 на 1256.49 EUR з ПДВ (рядків: 13). Ці суми входять у продажі, тому прибуток менший за різницю продажів і собівартості.'
  const view = show({ ...request, Notes: [...request.Notes!, unshipped] })
  const notes = screen.getByRole('complementary', { name: 'Примітки до звіту' })
  expect(within(notes).getByText(unshipped)).toBeTruthy()
  expect(notes.textContent).toContain('1256.49 EUR')
  const folded = view.container.querySelector('details')!
  expect(within(folded).getByText('Ще примітки: 1')).toBeTruthy()
  expect(folded.querySelectorAll('li')).toHaveLength(1)
  expect(notes.querySelectorAll(':scope > ul > li')).toHaveLength(3)
  expect(notes.querySelector(':scope > ul > li')?.textContent).toBe(unshipped)
})

it('shows no notes block when the server sends none', () => {
  show({ ...request, Notes: [] })
  expect(screen.queryByRole('complementary', { name: 'Примітки до звіту' })).toBeNull()
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
  expect(screen.getAllByText('Повторена примітка')).toHaveLength(1)
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
    RowSchema: [{ Caption: 'Дата' }, { Caption: 'Організація' }], ColumnSchema: [{ Caption: 'Група', Identity: '$measureGroup' }, { Caption: 'Показник', Identity: '$measure' }],
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
  render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>)
  const table = within(screen.getByRole('region', { name: 'Таблиця попереднього перегляду' }))
  expect(table.getByRole('rowheader', { name: 'ТОВ «АМГ «КОНКОРД»' })).toBeTruthy()
  expect(table.getByRole('columnheader', { name: 'Продажі без ПДВ, EUR' })).toBeTruthy()
  expect(table.getByRole('cell', { name: '2\u00a0260,30' })).toBeTruthy()
  expect(table.getByRole('cell', { name: '3\u00a0527' })).toBeTruthy()
})

function showFinancialMatrix(ids: (string | null)[], caption = 'Однакова організація', dimension = 'Organization') {
  const preview = normalizeNativeReportPreview({ Preview: {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: request,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    RowSchema: [{ Caption: 'Дата', Identity: 'Day' }],
    ColumnSchema: [{ Caption: 'Організація', Identity: dimension }, { Caption: 'Група', Identity: '$measureGroup' }, { Caption: 'Показник', Identity: '$measure' }],
    Rows: [{ Ordinal: 0, SourceIndex: 12, Values: [{ Caption: '17.10.2026' }] }],
    Columns: ids.flatMap((id, index) => ['Продажі', 'Собівартість'].map((measure, measureIndex) => ({ Ordinal: index * 2 + measureIndex, SourceIndex: index * 2 + measureIndex,
      Values: [{ Caption: caption, Identity: { Kind: id === null ? 'null' : 'signedInteger', Value: id, Provenance: 'columnAxisKey' } },
        { Caption: 'Прибуток', Identity: { Kind: 'string', Value: 'profit', Provenance: 'columnAxisKey' } },
        { Caption: measure, Identity: { Kind: 'reportField', Value: 'SalesValueWithoutVAT', Provenance: 'columnAxisKey' } }] }))),
    Cells: [{ RowSourceIndex: 12, ColumnSourceIndex: 1, Value: { Kind: 'null', Value: null, Provenance: 'producerCell' } }],
  } })
  return render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>)
}
it('keeps a single organization dimension visible instead of hiding it as a shared measure group', () => {
  showFinancialMatrix(['9223372036854775807'], 'Організація [9223372036854775807]')
  expect(screen.getByRole('columnheader', { name: 'Організація [9223372036854775807] / Прибуток / Продажі' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Організація [9223372036854775807] / Прибуток / Собівартість' })).toBeTruthy()
})
it('distinguishes equal organization captions by exact Int64 identity and keeps blank cells distinct from unknown', () => {
  const view = showFinancialMatrix(['9223372036854775806', '9223372036854775807'])
  for (const id of ['9223372036854775806', '9223372036854775807']) {
    expect(screen.getByRole('columnheader', { name: `Однакова організація [${id}] / Прибуток / Продажі` })).toBeTruthy()
  }
  expect(view.container.querySelectorAll('td[title="Клітинка відсутня"]')).toHaveLength(3)
  expect(screen.getByTitle('Значення не визначено.').textContent).toBe('—')
})

it.each(['CustomerName', 'CustomerContract'])('keeps distinct %s identities visible even with equal names and an unknown identity', dimension => {
  const view = showFinancialMatrix(['9223372036854775806', '9223372036854775807', null], 'Не вказано', dimension)
  for (const id of ['9223372036854775806', '9223372036854775807'])
    expect(screen.getByRole('columnheader', { name: `Не вказано [${id}] / Прибуток / Продажі` })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Не вказано / Прибуток / Продажі' })).toBeTruthy()
  expect(view.container.textContent).not.toContain('[0]')
  expect(view.container.querySelectorAll('td[title="Клітинка відсутня"]')).toHaveLength(5)
  expect(screen.getByTitle('Значення не визначено.').textContent).toBe('—')
})

it('shows no per-group subtotal under single-level rows and keeps the grand total', () => {
  const amount = (Value: string) => ({ Kind: 'decimal', Value, Provenance: 'producerCell' })
  const preview = normalizeNativeReportPreview({ Preview: {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: request,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 2, ReturnedRows: 2, HasMore: false },
    RowSchema: [{ Caption: 'День' }], ColumnSchema: [{ Caption: 'Сума' }],
    Rows: [{ Ordinal: 0, SourceIndex: 12, Values: [{ Caption: '12.09.2026' }] }, { Ordinal: 1, SourceIndex: 13, Values: [{ Caption: '13.09.2026' }] }],
    Columns: [{ Ordinal: 0, SourceIndex: 3, Values: [{ Caption: 'Сума' }] }],
    Cells: [{ RowSourceIndex: 12, ColumnSourceIndex: 3, Value: amount('10') }, { RowSourceIndex: 13, ColumnSourceIndex: 3, Value: amount('20') }],
    Totals: { State: 'materialized', Values: [{ RowSourceIndex: -1, ColumnSourceIndex: 3, Value: amount('30') }], Groups: [
      { Level: 0, RowSourceIndex: 12, RowCount: 1, Values: [{ RowSourceIndex: 12, ColumnSourceIndex: 3, Value: amount('10') }] },
      { Level: 0, RowSourceIndex: 13, RowCount: 1, Values: [{ RowSourceIndex: 13, ColumnSourceIndex: 3, Value: amount('20') }] },
    ] },
  } })
  const view = render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>)
  expect(view.container.querySelectorAll('.report-inline-preview__group-total')).toHaveLength(0)
  expect(view.container.querySelectorAll('tbody tr')).toHaveLength(2)
  expect(view.container.querySelector('tbody th.is-repeat')).toBeNull()
  expect(screen.getByRole('rowheader', { name: 'Загальний підсумок' })).toBeTruthy()
})

function showProfit(profile?: 'grossProfit' | 'sales', cells: unknown[] = []) {
  const money = { kind: 'money', currencyPolicy: 'EUR', unitPolicy: 'currency', aggregation: 'sum', scalable: true, defaultDecimalPlaces: 2 }
  const preview = normalizeNativeReportPreview({ Preview: {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: { ...request, DataSource: 'NativeSalesNet', Notes: [] },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    RowSchema: [{ Caption: 'Організація' }], ColumnSchema: [{ Caption: 'Група', Identity: '$measureGroup' }, { Caption: 'Показник', Identity: '$measure' }],
    Rows: [{ Ordinal: 0, SourceIndex: 1, Values: [{ Caption: 'АМГ' }] }],
    Columns: [{ Ordinal: 0, SourceIndex: 0, Values: [{ Caption: 'Собівартість, EUR' }, { Caption: 'Без ПДВ' }] },
      { Ordinal: 1, SourceIndex: 1, Values: [{ Caption: 'Валовий прибуток, EUR' }, { Caption: 'Без ПДВ' }] }],
    Cells: cells,
    valueSemantics: [{ columnSourceIndex: 0, measureType: 6, semantics: money }, { columnSourceIndex: 1, measureType: 10, semantics: money }],
  } })
  return render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} previewReportProfile={profile} /></I18nProvider></MantineProvider>)
}

it('heads the profit column with the server caption «Валовий прибуток» in both constructor profiles', () => {
  for (const profile of ['grossProfit', 'sales'] as const) {
    const view = showProfit(profile)
    expect(screen.getByRole('columnheader', { name: 'Валовий прибуток, EUR / Без ПДВ' })).toBeTruthy()
    expect(view.container.textContent).not.toContain('Націнка')
    view.unmount()
  }
})

it('shows a mixed-unit quantity breakdown in full instead of a blank cell', () => {
  const text = '3\u00a0420 шт · 593 компл · 35 м · 4 без одиниці'
  const view = showProfit('sales', [{ RowSourceIndex: 1, ColumnSourceIndex: 0, Value: { Kind: 'text', Value: text, Provenance: 'quantityBreakdown' } }])
  const cell = view.container.querySelector('td.is-quantity-breakdown')
  expect(cell?.textContent).toBe('3\u00a0420\u00a0шт · 593\u00a0компл · 35\u00a0м · 4\u00a0без\u00a0одиниці')
  expect(view.container.textContent).not.toContain('—')
})
