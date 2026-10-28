import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { productTimeDataset } from '../data/currentFinancialProductTimeAxes.test-fixtures'
import { documentDataset } from '../data/currentFinancialDocumentAxes.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'
import { changeReportPeriod } from '../testing/reportPeriod'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true, user: { NetUid: 'document-axis-test' } }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks();localStorage.clear();sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: '9007199254740993', Name: 'Точний товар' }])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/document-axis.xlsx' }, raw: {} })
})
afterEach(() => { cleanup();localStorage.clear();sessionStorage.clear() })
async function open(admitted: boolean) {
  const dataset = admitted ? documentDataset : productTimeDataset
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, { ...dataset, profitReadModeLookup: true,
    Filters: dataset.Filters.map(field => ({ ...field, Name: field.Type === 1 ? 'Товар' : field.Name })) }])
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити ВП.xls' }))
  await waitFor(() => expect(screen.queryByText(/застосовуються відбори книги/i)).toBeNull())
  return view
}
function addAxis(axis: 'рядків' | 'стовпців', label: string) {
  fireEvent.click(screen.getByRole('button', { name: `Додати поле: Групування ${axis}` }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('checkbox', { name: `Вибрати ${label}` }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Додати вибрані (1)' }))
}
it('does not offer document grouping with the previous server capability', async () => {
  await open(false)
  fireEvent.click(screen.getByRole('button', { name: 'Видалити Дата' }))
  fireEvent.click(screen.getByRole('button', { name: 'Додати поле: Групування рядків' }))
  expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Документ' })).toBeNull()
})
it('selects document/product, preserves dates and a negative filter through mode refusal, then transposes', async () => {
  const view = await open(true)
  fireEvent.click(screen.getByRole('button', { name: 'Видалити Дата' }))
  fireEvent.click(screen.getByRole('button', { name: 'Видалити Організація' }))
  addAxis('рядків', 'Документ');addAxis('стовпців', 'Товар')
  fireEvent.click(screen.getByRole('button', { name: 'Додати умову' }))
  const dialog = await screen.findByRole('dialog', { name: 'Додати умову відбору' })
  fireEvent.click(within(dialog).getByRole('combobox', { name: 'Поле' }));fireEvent.click(screen.getByRole('option', { name: 'Товар' }))
  fireEvent.click(within(dialog).getByRole('combobox', { name: 'Умова' }));fireEvent.click(screen.getByRole('option', { name: 'Не дорівнює' }))
  fireEvent.click(within(dialog).getByRole('combobox', { name: 'Значення' }));fireEvent.click(await screen.findByRole('option', { name: 'Точний товар' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))
  changeReportPeriod({ from: '2026-10-17', to: '2026-10-23' })
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!) })
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(1))
  const before = vi.mocked(createStockReport).mock.calls[0][0]
  expect(before.sorted.Row.map(f => f.type)).toEqual([81]);expect(before.sorted.Col.map(f => f.type)).toEqual([5])
  expect(before.selections[0]).toMatchObject({ FilterCondition: { Type: 1 }, Values: [{ Data: { Id: '9007199254740993' } }] })
  fireEvent.click(screen.getByRole('combobox', { name: 'Джерело розрахунку' }));fireEvent.click(screen.getByRole('option', { name: 'Збережені регістри 1С' }))
  expect(screen.getByRole('button', { name: 'Сформувати' })).toHaveProperty('disabled', true)
  expect(screen.getByRole('button', { name: 'Сформувати' }).getAttribute('title')).toContain('Групування за документом доступне лише')
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!) })
  expect(createStockReport).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('combobox', { name: 'Джерело розрахунку' }));fireEvent.click(screen.getByRole('option', { name: 'Поточні документи GBA' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Сформувати' })).toHaveProperty('disabled', false))
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!) })
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
  expect(vi.mocked(createStockReport).mock.calls[1][0]).toEqual(before)
  fireEvent.click(screen.getByRole('button', { name: 'Видалити Документ' }));fireEvent.click(screen.getByRole('button', { name: 'Видалити Товар' }))
  addAxis('рядків', 'Товар');addAxis('стовпців', 'Документ')
  expect(screen.getByText('До 100 документів у колонках — кожен документ окремим аркушем, більше — одна таблиця.')).toBeTruthy()
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!) })
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(3))
  const transposed = vi.mocked(createStockReport).mock.calls[2][0]
  expect(transposed.sorted.Row.map(f => f.type)).toEqual([5]);expect(transposed.sorted.Col.map(f => f.type)).toEqual([81])
  expect(transposed.selections).toEqual(before.selections);expect(transposed.from).toBe(before.from);expect(transposed.to).toBe(before.to)
})
