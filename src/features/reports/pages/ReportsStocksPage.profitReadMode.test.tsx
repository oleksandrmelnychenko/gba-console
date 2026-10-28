import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { profitDayDataset, profitSupplierDataset } from '../data/profitReadMode.test-fixtures'
import { FENIX_BUYERS_ROOT_ID } from '../data/nativeExactFilters'
import { ReportsStocksPage } from './ReportsStocksPage'
import { WORKBOOK_FILES } from '../testing/workbookFiles'
import { currentFinancialDataset } from '../data/currentFinancialAxes.test-fixtures'
import { productTimeDataset } from '../data/currentFinancialProductTimeAxes.test-fixtures'
import { changeReportPeriod } from '../testing/reportPeriod'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true, user: { NetUid: 'profit-mode-owner' } }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, profitDayDataset, profitSupplierDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/current.xlsx' }, raw: {} })
})
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear() })
async function openWorkbook(name: string) {
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('button', { name: `Відкрити ${WORKBOOK_FILES[name] ?? name}` }))
  await waitFor(() => expect(screen.queryByText(/застосовуються відбори книги/i)).toBeNull())
  return view
}
function mode(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Джерело розрахунку' }))
  fireEvent.click(screen.getByRole('option', { name }))
}
const source = () => (screen.getByRole('combobox', { name: 'Джерело розрахунку' }) as HTMLInputElement).value
async function submitted(view: ReturnType<typeof render>, count: number) {
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(count))
  return vi.mocked(createStockReport).mock.calls[count - 1][0]
}
it.each(['Валовий прибуток за днем', 'Валовий прибуток за постачальниками'])('opens %s on current documents, then keeps deliberate registers and opt-out choices', async name => {
  const view = await openWorkbook(name)
  expect(source()).toBe('Поточні документи GBA')
  expect(screen.getByText(/Продажі та повернення з документів GBA за період до 31 календарних днів, звірені з 1С/)).toBeTruthy()
  const current = await submitted(view, 1)
  expect(current.profitReadMode).toBe(0)
  expect(current.dataSource === 35 ? current.dayOrganizationBasis : current.supplierBasis).toBe(0)
  if (current.dataSource === 35) {
    expect(current).not.toHaveProperty('productClassification')
    expect(current).not.toHaveProperty('sourceOrganizations')
    expect(current).toMatchObject({ sourceBuyerSubtree: { BuyerRootId: FENIX_BUYERS_ROOT_ID },
      workbookPresentation: { version: 1, additionalFields: [2, 3], ordering: 'MonthAscending' } })
    expect((screen.getByRole('checkbox', { name: 'Група «Покупці»' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.queryByRole('checkbox', { name: 'Організації книги ВП' })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'Товар без послуг (Fenix)' })).toBeNull()
  } else {
    expect(current.workbookPresentation).toBeUndefined()
    expect(current.supplierSourceWorld).toBeUndefined()
    expect(screen.queryByRole('combobox', { name: 'База продажів для прибутку за постачальниками' })).toBeNull()
    expect(current.sorted.Row.map(row => row.type)).toEqual([78, 4, 21])
  }
  mode('Збережені регістри 1С')
  expect(screen.queryByRole('dialog')).toBeNull()
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!) })
  expect(createStockReport).toHaveBeenCalledTimes(1)
  mode('За налаштуваннями звіту')
  expect(source()).toBe('За налаштуваннями звіту')
  const unmarked = await submitted(view, 2)
  expect(Object.hasOwn(unmarked, 'profitReadMode')).toBe(false)
})
it('hides current opt-in without a confirmed capability', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, { ...profitDayDataset, profitReadMode: undefined }])
  await openWorkbook('Валовий прибуток за днем')
  expect(screen.queryByRole('combobox', { name: 'Джерело розрахунку' })).toBeNull()
})

it('selects client/agreement axes and blocks a mode switch without dropping dates, filters or groupings', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, currentFinancialDataset, profitSupplierDataset])
  const view = await openWorkbook('Валовий прибуток за днем')
  fireEvent.click(screen.getByRole('button', { name: 'Видалити Дата' }))
  fireEvent.click(screen.getByRole('button', { name: 'Видалити Організація' }))
  for (const [axis, label] of [['рядків', 'Клієнт'], ['стовпців', 'Договір']]) {
    fireEvent.click(screen.getByRole('button', { name: `Додати поле: Групування ${axis}` }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('checkbox', { name: `Вибрати ${label}` }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Додати вибрані (1)' }))
  }
  expect(screen.getByText('До 100 договорів у колонках — кожен договір окремим аркушем, більше — одна таблиця.')).toBeTruthy()
  changeReportPeriod({ from: '2026-10-17', to: '2026-10-23' })
  const before = await submitted(view, 1)
  expect(before.sorted.Row.map(f => f.type)).toEqual([12])
  expect(before.sorted.Col.map(f => f.type)).toEqual([15])
  mode('Збережені регістри 1С')
  expect(screen.getAllByText(/Групування за клієнтом і договором доступне лише/).length).toBeGreaterThan(0)
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!) })
  expect(createStockReport).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Видалити Клієнт' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Видалити Договір' })).toBeTruthy()
  mode('Поточні документи GBA')
  const after = await submitted(view, 2)
  expect(after).toEqual(before)
})

it('selects product/month axes, keeps them during an incompatible mode switch and submits the exact retained settings', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, productTimeDataset, profitSupplierDataset])
  const view = await openWorkbook('Валовий прибуток за днем')
  fireEvent.click(screen.getByRole('button', { name: 'Видалити Дата' }))
  fireEvent.click(screen.getByRole('button', { name: 'Видалити Організація' }))
  for (const [axis, label] of [['рядків', 'Товар'], ['стовпців', 'Місяць']]) {
    fireEvent.click(screen.getByRole('button', { name: `Додати поле: Групування ${axis}` }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('checkbox', { name: `Вибрати ${label}` }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Додати вибрані (1)' }))
  }
  expect(screen.getByText('До 100 місяців у колонках — кожен місяць окремим аркушем, більше — одна таблиця.')).toBeTruthy()
  changeReportPeriod({ from: '2026-10-17', to: '2026-10-23' })
  const before = await submitted(view, 1)
  expect(before.sorted.Row.map(f => f.type)).toEqual([5])
  expect(before.sorted.Col.map(f => f.type)).toEqual([2])
  mode('Збережені регістри 1С')
  expect(screen.getAllByText(/Групування за товаром, роком, кварталом і місяцем доступне лише/).length).toBeGreaterThan(0)
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!) })
  expect(createStockReport).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Видалити Товар' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Видалити Місяць' })).toBeTruthy()
  mode('Поточні документи GBA')
  expect(await submitted(view, 2)).toEqual(before)
})
