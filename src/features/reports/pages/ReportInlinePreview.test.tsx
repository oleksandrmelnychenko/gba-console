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

it('shows the result without server notes or technical report descriptions', () => {
  const view = show()
  expect(screen.queryByText('Про дані звіту')).toBeNull()
  expect(screen.queryByText('Як розраховано')).toBeNull()
  expect(screen.queryByText('Застосовані фільтри')).toBeNull()
  expect(screen.queryByText(/Період розрахунку:/)).toBeNull()
  expect(screen.queryByRole('complementary', { name: 'Примітки до звіту' })).toBeNull()
  for (const note of request.Notes!) expect(screen.queryByText(note)).toBeNull()
  expect(view.container.querySelector('details')).toBeNull()
  expect(view.container.textContent).not.toContain('NativeDayOrganizationGrossProfit')
  expect(view.container.textContent).not.toContain('a'.repeat(64))
  expect(screen.getByTitle('Значення не визначено.').textContent).toBe('—')
})

it('warns explicitly about ignored filters and their server reason', () => {
  show({ ...request, IgnoredFilters: [{ Field: 'Договір', Condition: 'Дорівнює', Values: ['Обраний договір'], IgnoredReason: 'Цей відбір не застосовано до результату.' }] })
  const warning = screen.getByRole('alert')
  expect(within(warning).getByText('Відбори не застосовано')).toBeTruthy()
  expect(within(warning).getByText('Договір Дорівнює: Обраний договір (Цей відбір не застосовано до результату.)')).toBeTruthy()
})

it('does not show provenance notes such as unattributed returns or unshipped sales', () => {
  const gap = 'Повернень без підтвердженого первинного продажу в GBA: 1 (рядків: 1), сума 1.22 EUR з ПДВ.'
  const unshipped = 'Продажі GBA без відвантаження не враховано в собівартості та прибутку: 10 на 1256.49 EUR з ПДВ (рядків: 13).'
  show({ ...request, Notes: [...request.Notes!, gap, unshipped] })
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByText(gap)).toBeNull()
  expect(screen.queryByText(unshipped)).toBeNull()
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

it('shows no technical banner when attribution or the ignored-filter list is missing', () => {
  const view = show(null)
  expect(screen.queryByText('Опис розрахунку відсутній')).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
  view.unmount()
  show({ ...request, HasPeriod: false, Filters: null, IgnoredFilters: null, Notes: null })
  expect(screen.queryByText('Відомості про незастосовані фільтри відсутні')).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
})

it('does not label a current snapshot with a technical banner', () => {
  const times = { ObservationStartedAtUtc: '2026-09-27T10:00:00.0000000Z', ObservationCompletedAtUtc: '2026-09-27T10:00:01.0000000Z' }
  show({ ...request, ...times, IsCurrentSnapshot: true, HasPeriod: false })
  expect(screen.queryByText('Поточний стан')).toBeNull()
  expect(screen.queryByText(/Дані прочитано/)).toBeNull()
})

it('retains repeated ignored filters and hides exact technical identities', () => {
  const guid = '11111111222233334444555555555555'
  const view = show({ ...request, Notes: ['Повторена примітка', 'Повторена примітка'],
    IgnoredFilters: [0, 1].map(() => ({ Field: 'Вид товару', Condition: 'У списку', Values: [guid, '[Id=42]', 'Назва товару [Id=64]'], IgnoredReason: null })) })
  expect(screen.queryByText('Повторена примітка')).toBeNull()
  expect(view.container.textContent).not.toContain(guid)
  expect(view.container.textContent).not.toContain('[Id=42]')
  expect(view.container.textContent).not.toContain('[Id=64]')
  expect(screen.getAllByText('Вид товару У списку: Обране точне значення, Обране точне значення, Назва товару')).toHaveLength(2)
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

it('shows a single-unit quantity with its unit as an ordinary number cell', () => {
  const cellOf = (text: string) => {
    const view = showProfit('sales', [{ RowSourceIndex: 1, ColumnSourceIndex: 0, Value: { Kind: 'text', Value: text, Provenance: 'quantityBreakdown' } }])
    const cell = [...view.container.querySelectorAll('td')].find(item => item.textContent === text.replace(/ /g, '\u00a0'))
    const result = { found: !!cell, className: cell?.className ?? '', breakdowns: view.container.querySelectorAll('td.is-quantity-breakdown').length }
    view.unmount()
    return result
  }
  expect(cellOf('3\u00a0шт')).toEqual({ found: true, className: '', breakdowns: 0 })
  expect(cellOf('−2\u00a0шт')).toEqual({ found: true, className: '', breakdowns: 0 })
})
