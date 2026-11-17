import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { returnStatusDataset } from '../data/returnItemStatuses.test-fixtures'
import { CUSTOMER_RETURN_FILTERS, customerReturnRequest } from '../data/customerReturnReport'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { changeReportPeriod } from '../testing/reportPeriod'
import type { ReportDataset } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: null, hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))

const SERVER_FILTERS: Array<[number, string]> = [[0, 'Організація'], [1, 'Товар'], [2, 'Артикул'], [3, 'Топ товару'], [4, 'Група товару'],
  [6, 'Клієнт'], [7, 'Регіон клієнта'], [8, 'Код регіону'], [9, 'Договір'], [10, 'Менеджер клієнта'], [11, 'Тип ціни'],
  [12, 'Документ продажу'], [14, 'Повернення від клієнта'], [15, 'Ввів документ'], [16, 'Провів документ'], [21, 'Склад'],
  [64, 'Причина повернення'], [20, 'Одиниця виміру']]
const RETURN_FILTERS = [0, 1, 2, 3, 4, 20, 6, 7, 8, 9, 10, 14, 21, 64]

function serverDataset(returnsOnlyFilters: readonly number[]): ReportDataset {
  const rows = [...new Set(returnStatusDataset.Groupings.map(field => field.Type))]
  return { ...returnStatusDataset, Filters: SERVER_FILTERS.map(([Type, Name]) => ({ Type, Name })),
    FilterExpression: { Version: 1, MaximumDepth: 8, MaximumLeaves: 64, MaximumNodes: 128, Operators: [1, 2] },
    configuration: { version: 1, axisMode: 'flexible', allowedRows: rows, allowedColumns: rows, minimumRows: 1, maximumRows: rows.length,
      allowRowReorder: true, rowLayouts: [], columnLayouts: [], mutuallyExclusiveRows: [],
      period: { required: true, supported: true, maximumDays: null, maximumMonths: null, minimumDate: null },
      variants: [{ key: 'returnsOnly', axisMode: 'fixedLayouts', allowedRows: [12, 5, 3], allowedColumns: [], minimumRows: 3, maximumRows: 3,
        rowLayouts: [[12, 5, 3]], columnLayouts: [[]], period: null, filters: [...returnsOnlyFilters], maximumColumns: 0 }], maximumColumns: rows.length } }
}

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null, Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false }, RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [] } })
})
afterEach(cleanup)

async function openReturns(dataset: ReportDataset) {
  vi.mocked(getReportDatasets).mockResolvedValue([dataset])
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  const nav = await screen.findByRole('navigation', { name: 'Розділи звітів' })
  const sales = within(nav).getByRole('button', { name: 'Особливі звіти' })
  await waitFor(() => expect(sales).toHaveProperty('disabled', false))
  fireEvent.click(sales)
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Звіт повернення' }))
  await screen.findByRole('button', { name: 'Додати відбір' })
  return view
}

function fieldOptions(row: ReturnType<typeof within>) {
  fireEvent.click(row.getByRole('combobox', { name: 'Поле' }))
  return screen.getAllByRole('option').map(option => option.textContent)
}

it('lists the common return-line fields with shared labels and offers І/АБО groups', async () => {
  await openReturns(serverDataset(RETURN_FILTERS))
  fireEvent.click(screen.getByRole('button', { name: 'Додати відбір' }))
  const row = within(screen.getByRole('group', { name: 'Умова відбору 1' }))
  expect(fieldOptions(row)).toEqual(['Організація', 'Товар', 'Артикул', 'Топ', 'Товарна група', 'Одиниця виміру', 'Покупець',
    'Регіон', 'Код по регіону', 'Договір', 'Відповідальний менеджер покупця',
    'Повернення від клієнта', 'Причина повернення', 'Склад'])
  fireEvent.click(screen.getByRole('option', { name: 'Договір' }))
  const search = row.getByPlaceholderText('Пошук значення')
  act(() => search.focus())
  fireEvent.change(search, { target: { value: 'Дог' } })
  await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(2, 9, expect.objectContaining({ value: 'Дог' }), expect.anything()))
  expect(screen.getByRole('region', { name: 'Логіка умов відбору' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Додати відбір' }))
  fireEvent.click(screen.getByRole('button', { name: 'Налаштувати групи І/АБО' }))
  expect(await screen.findByRole('button', { name: 'Очистити групи: усі умови через І' })).toBeTruthy()
})

it('keeps the original five fields and no І/АБО panel on a server that has not widened the returns form', async () => {
  await openReturns(serverDataset(CUSTOMER_RETURN_FILTERS))
  fireEvent.click(screen.getByRole('button', { name: 'Додати відбір' }))
  const row = within(screen.getByRole('group', { name: 'Умова відбору 1' }))
  expect(fieldOptions(row)).toEqual(['Товар', 'Артикул', 'Покупець', 'Причина повернення', 'Склад'])
  expect(screen.queryByRole('region', { name: 'Логіка умов відбору' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Налаштувати групи І/АБО' })).toBeNull()
})

it('sends the returns request with the new fields and their І/АБО tree', async () => {
  const dataset = serverDataset(RETURN_FILTERS)
  const data = customerReturnRequest(defaultDatasetRequest(dataset, '2026-10-01', '2026-10-27'), dataset)
  data.selections = [
    { IsChecked: true, SelectedField: { Type: 0, Name: 'Організація' }, FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [{ Name: 'Фірма', Data: { Id: 1, Name: 'Фірма' }, Value: 1 }] },
    { IsChecked: true, SelectedField: { Type: 7, Name: 'Регіон клієнта' }, FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [{ Name: 'Київ', Data: { Id: 32, Name: 'Київ' }, Value: 32 }] }]
  const filterExpression = { Version: 1, Root: { Kind: 2, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 1 }] } }
  vi.mocked(getReportDatasets).mockResolvedValue([dataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 1, Name: 'Повернення АБО', Data: { ...data, filterExpression } }])
  const { container } = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: /Відкрити Звіт повернення/ })
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Повернення АБО' }))
  expect(await screen.findByRole('button', { name: 'Очистити групи: усі умови через І' })).toBeTruthy()
  changeReportPeriod({ from: '2026-09-01', to: '2026-09-30' })
  await act(async () => fireEvent.submit(container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 2, returnsOnly: true, from: '2026-09-01', filterExpression,
    selections: [{ SelectedField: { Type: 0 }, Values: [{ Data: { Id: 1 } }] }, { SelectedField: { Type: 7 }, Values: [{ Data: { Id: 32 } }] }] })
})
