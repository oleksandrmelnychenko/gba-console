import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { ReportInlinePreview } from './ReportInlinePreview'

const managers = ['Баранов Віталій', 'Грель Христина']
const measures = [['Кількість продажу', 'Кількість з урахуванням повернень', 0], ['Вартість продажу, EUR', 'Продажі без ПДВ з урахуванням повернень', 2],
  ['Вартість продажу, EUR', 'Продажі з ПДВ з урахуванням повернень', 4], ['Рентабельність, %', 'Рентабельність без ПДВ, %', 14]] as const
const scalar = (value: string) => ({ Kind: 'decimal', Value: value, Provenance: 'producerCell' })
const rows = [['ТОВ «АМГ «КОНКОРД»', 'Баранов Віталій'], ['ТОВ «АМГ «КОНКОРД»', 'Грель Христина'], ['Фенікс', 'Баранов Віталій']]

function show(profile?: 'sales') {
  const columns = managers.flatMap(manager => measures.map(([group, measure]) => [manager, group, measure]))
  const cell = (row: number, column: number, value: string) => ({ RowSourceIndex: row, ColumnSourceIndex: column, Value: scalar(value) })
  const preview = normalizeNativeReportPreview({ Preview: {
    Version: 1, ResultSha256: 'c'.repeat(64), PresentationOnly: true,
    Request: { DataSource: 'NativeSalesNet', IsCurrentSnapshot: false, HasPeriod: true, PeriodFrom: '01.11.2026', PeriodTo: '08.11.2026',
      RowGroupings: ['Організація', 'Провів документ'], ColumnGroupings: ['Ввів документ'], Measures: measures.map(measure => measure[1]), Filters: [], IgnoredFilters: [], Notes: [] },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 3, ReturnedRows: 3, HasMore: false },
    RowSchema: [{ Caption: 'Організація' }, { Caption: 'Провів документ' }],
    ColumnSchema: [{ Caption: 'Ввів документ' }, { Caption: 'Група показників' }, { Caption: 'Показник' }],
    Rows: rows.map((values, index) => ({ Ordinal: index, SourceIndex: index, Values: values.map(Caption => ({ Caption })) })),
    Columns: columns.map((values, index) => ({ Ordinal: index, SourceIndex: index, Values: values.map(Caption => ({ Caption })) })),
    Cells: [cell(0, 1, '100'), cell(1, 5, '50'), cell(2, 1, '7')],
    Totals: { State: 'materialized', Values: [cell(-1, 1, '107'), cell(-1, 5, '50')],
      Groups: [{ Level: 0, RowSourceIndex: 0, RowCount: 2, Values: [cell(0, 1, '100'), cell(0, 5, '50')] },
        { Level: 0, RowSourceIndex: 2, RowCount: 1, Values: [cell(2, 1, '7')] }] },
    valueSemantics: columns.map((_, index) => ({ columnSourceIndex: index, measureType: measures[index % measures.length][2],
      semantics: { kind: 'money', currencyPolicy: 'EUR', unitPolicy: 'currency', aggregation: 'sum', scalable: true,
        defaultDecimalPlaces: 2, defaultMinimumDecimalPlaces: 2 } })),
  } })
  return render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} {...(profile ? { previewReportProfile: profile } : {})} /></I18nProvider></MantineProvider>)
}

it('splits the column heading into the tiers of the exported document and keeps the full path as the accessible name', () => {
  const view = show('sales')
  const tiers = [...view.container.querySelectorAll('thead tr')].map(row => [...row.querySelectorAll('th')].map(heading =>
    `${heading.textContent}${heading.colSpan > 1 ? `×${heading.colSpan}` : ''}${heading.rowSpan > 1 ? `↓${heading.rowSpan}` : ''}`))
  expect(tiers).toEqual([
    ['Організація↓3', 'Провів документ↓3', 'Баранов Віталій×4', 'Грель Христина×4'],
    ['Кількість продажу', 'Вартість продажу, EUR×2', 'Рентабельність, %', 'Кількість продажу', 'Вартість продажу, EUR×2', 'Рентабельність, %'],
    ['Кількість', 'Без ПДВ', 'З ПДВ', 'Без ПДВ', 'Кількість', 'Без ПДВ', 'З ПДВ', 'Без ПДВ'],
  ])
  expect(screen.getByRole('columnheader', { name: 'Грель Христина / Вартість продажу, EUR / Продажі без ПДВ з урахуванням повернень' }).textContent).toBe('Без ПДВ')
})

it('closes each group with its subtotal after the rows and leaves absent intersections blank', () => {
  show('sales')
  const body = within(screen.getByRole('table')).getAllByRole('row').filter(row => row.closest('tbody'))
  expect(body.map(row => row.querySelector('th')?.textContent)).toEqual(['ТОВ «АМГ «КОНКОРД»', 'ТОВ «АМГ «КОНКОРД»',
    'Підсумок: ТОВ «АМГ «КОНКОРД»', 'Фенікс', 'Підсумок: Фенікс'])
  expect(within(body[1]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['', '', '', '', '', '50,00', '', ''])
  expect(within(body[2]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['', '100,00', '', '', '', '50,00', '', ''])
})

it('keeps subtotals above the rows and full measure captions outside the sales document profile', () => {
  const view = show()
  const body = within(screen.getByRole('table')).getAllByRole('row').filter(row => row.closest('tbody'))
  expect(body[0].querySelector('th')?.textContent).toBe('Підсумок: ТОВ «АМГ «КОНКОРД»')
  expect([...view.container.querySelectorAll('thead tr:last-child th')].map(heading => heading.textContent).slice(0, 2))
    .toEqual(['Кількість з урахуванням повернень', 'Продажі без ПДВ з урахуванням повернень'])
  expect(within(body[2]).getAllByRole('cell')[0].textContent).toBe('—')
})

function measurePreview(source: string, columns: [number, string[]][]) {
  return normalizeNativeReportPreview({ Preview: {
    Version: 1, ResultSha256: 'd'.repeat(64), PresentationOnly: true,
    Request: { DataSource: source, IsCurrentSnapshot: false, HasPeriod: true, PeriodFrom: '01.10.2026', PeriodTo: '31.10.2026',
      RowGroupings: ['Склад'], ColumnGroupings: [], Measures: columns.map(column => column[1].at(-1)), Filters: [], IgnoredFilters: [], Notes: [] },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    RowSchema: [{ Caption: 'Склад' }], ColumnSchema: columns[0][1].map((_, index) => ({ Caption: `Рівень ${index + 1}` })),
    Rows: [{ Ordinal: 0, SourceIndex: 0, Values: [{ Caption: 'СКЛАД' }] }],
    Columns: columns.map(([, values], index) => ({ Ordinal: index, SourceIndex: index, Values: values.map(Caption => ({ Caption })) })),
    Cells: columns.map((_, index) => ({ RowSourceIndex: 0, ColumnSourceIndex: index, Value: scalar(String(index + 1)) })),
    valueSemantics: columns.map(([measureType], index) => ({ columnSourceIndex: index, measureType,
      semantics: { kind: 'money', currencyPolicy: 'EUR', unitPolicy: 'currency', aggregation: 'sum', scalable: true,
        defaultDecimalPlaces: 2, defaultMinimumDecimalPlaces: 2 } })),
  } })
}
const tiersOf = (container: HTMLElement) => [...container.querySelectorAll('thead tr')].map(row => [...row.querySelectorAll('th')].map(heading =>
  `${heading.textContent}${heading.colSpan > 1 ? `×${heading.colSpan}` : ''}${heading.rowSpan > 1 ? `↓${heading.rowSpan}` : ''}`))

it('groups the stock period measures under opening, incoming, outgoing and closing like the exported document', () => {
  const names = ['Початковий залишок', 'Прихід', 'Розхід', 'Кінцевий залишок'].flatMap(group => ['кількість', 'собівартість з витратами без ПДВ, EUR', 'ПДВ, EUR']
    .map(measure => `${group}: ${measure}`))
  const view = render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={measurePreview('NativeStockPeriod',
    names.map((name, index) => [97 + index, [name, name]]))} /></I18nProvider></MantineProvider>)
  expect(tiersOf(view.container)).toEqual([
    ['Склад↓2', 'Початковий залишок×3', 'Прихід×3', 'Розхід×3', 'Кінцевий залишок×3'],
    Array.from({ length: 4 }, () => ['Кількість', 'Собівартість без ПДВ, EUR', 'ПДВ, EUR']).flat(),
  ])
})

it('groups purchase measures under each supplier contract without repeating the measure caption', () => {
  const view = render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={measurePreview('NativePurchases',
    [[0, ['Договір А', 'Кількість надходження', 'Кількість надходження']], [2, ['Договір А', 'Вартість надходження без ПДВ, EUR', 'Вартість надходження без ПДВ, EUR']],
      [96, ['Договір А', 'Вага (нетто), кг', 'Вага (нетто), кг']]])} /></I18nProvider></MantineProvider>)
  expect(tiersOf(view.container)).toEqual([['Склад↓3', 'Договір А×3'], ['Надходження×3'], ['Кількість', 'Вартість без ПДВ, EUR', 'Вага (нетто), кг']])
})

it('does not repeat a measure caption that equals its group caption', () => {
  const view = render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={measurePreview('NativeCustomerGroupComparison',
    [[109, ['Еталон', 'Кількість', 'Кількість']], [110, ['Еталон', 'Вартість без ПДВ, EUR', 'Вартість без ПДВ, EUR']]])} /></I18nProvider></MantineProvider>)
  expect(tiersOf(view.container)).toEqual([['Склад↓2', 'Еталон×2'], ['Кількість', 'Вартість без ПДВ, EUR']])
})
