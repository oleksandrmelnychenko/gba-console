import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { profitDayDataset } from '../data/profitReadMode.test-fixtures'
import { financialFilterCapability } from '../data/currentFinancialFilterConditions.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'
import { WORKBOOK_FILES } from '../testing/workbookFiles'
import { changeReportPeriod } from '../testing/reportPeriod'
import { findOpenedWorkbook } from '../testing/workbookDesk'

vi.mock('../reportSurfacePolicy', () => ({ BUG_1274_ONLY_REPORT_SURFACE: true }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true, user: { NetUid: 'financial-filter-test' } }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: '9007199254740993', Name: 'Точний товар' }])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/filter.xlsx' }, raw: {} })
})
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear() })
function dataset(admitted: boolean) {
  return { ...profitDayDataset, profitReadModeLookup: true,
    Filters: profitDayDataset.Filters.map(field => ({ ...field, Name: field.Type === 1 ? 'Товар' : field.Name })),
    currentFinancialFilterConditions: admitted ? financialFilterCapability : undefined }
}
async function editor(admitted: boolean) {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, dataset(admitted)])
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('button', { name: `Відкрити ${WORKBOOK_FILES['Валовий прибуток за днем']}` }))
  await waitFor(() => expect(screen.queryByText(/застосовуються відбори книги/i)).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: 'Додати умову' }))
  const dialog = await screen.findByRole('dialog', { name: 'Додати умову відбору' })
  fireEvent.click(within(dialog).getByRole('combobox', { name: 'Поле' }));fireEvent.click(screen.getByRole('option', { name: 'Товар' }))
  return { ...view, dialog }
}
it('shows only admitted conditions with an old server', async () => {
  const view = await editor(false)
  fireEvent.click(within(view.dialog).getByRole('combobox', { name: 'Умова' }))
  expect(screen.getByRole('option', { name: 'Дорівнює' })).toBeTruthy()
  expect(screen.getByRole('option', { name: 'У списку' })).toBeTruthy()
  expect(screen.queryByRole('option', { name: 'Не дорівнює' })).toBeNull()
  expect(screen.queryByRole('option', { name: 'Не у списку' })).toBeNull()
})
it('submits an exact negative filter, preserves it after date edits and refuses incompatible mode without changing it', async () => {
  const view = await editor(true)
  fireEvent.click(within(view.dialog).getByRole('combobox', { name: 'Умова' }))
  fireEvent.click(screen.getByRole('option', { name: 'Не дорівнює' }))
  fireEvent.click(within(view.dialog).getByRole('combobox', { name: 'Значення' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Точний товар' }))
  fireEvent.click(within(view.dialog).getByRole('button', { name: 'Зберегти' }))
  changeReportPeriod({ from: '2026-10-17', to: '2026-10-23' })
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!) })
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(1))
  const before = vi.mocked(createStockReport).mock.calls[0][0]
  expect(before.selections[0]).toMatchObject({ FilterCondition: { Type: 1 }, Values: [{ Data: { Id: '9007199254740993' } }] })
  fireEvent.click(screen.getByRole('combobox', { name: 'Джерело розрахунку' }))
  fireEvent.click(screen.getByRole('option', { name: 'Збережені регістри 1С' }))
  // The legacy form exposes its blocking reason on the disabled submit button; the workbook uses a visible alert.
  expect(screen.getByRole('button', { name: 'Сформувати' })).toHaveProperty('disabled', true)
  expect(screen.getByRole('button', { name: 'Сформувати' }).getAttribute('title'))
    .toContain('Умови «Не дорівнює» та «Не у списку» доступні лише')
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!) })
  expect(createStockReport).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('combobox', { name: 'Джерело розрахунку' }))
  fireEvent.click(screen.getByRole('option', { name: 'Поточні документи GBA' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Сформувати' })).toHaveProperty('disabled', false))
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!) })
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
  expect(vi.mocked(createStockReport).mock.calls[1][0]).toEqual(before)
})

it.each([false, true])('gates the actual workbook inline condition selector on server admission: %s', async admitted => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, dataset(admitted)])
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await findOpenedWorkbook('ВП.xls')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', false))
  const filters = screen.getByRole('group', { name: 'Фільтри' })
  fireEvent.click(within(filters).getByRole('button', { name: 'Додати умову' }))
  fireEvent.click(within(filters).getByRole('combobox', { name: 'Поле' }))
  fireEvent.click(screen.getByRole('option', { name: 'Товар' }))
  fireEvent.click(within(filters).getByRole('combobox', { name: 'Умова' }))
  for (const name of ['Дорівнює', 'У списку']) expect(screen.getByRole('option', { name })).toBeTruthy()
  for (const name of ['Не дорівнює', 'Не у списку']) {
    const option = screen.queryByRole('option', { name })
    if (admitted) expect(option).toBeTruthy()
    else expect(option).toBeNull()
  }
})
