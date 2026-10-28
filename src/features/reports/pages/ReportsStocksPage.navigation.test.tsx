import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PageHeaderActionsProvider, PageSubmenuActionsSlot } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { searchDatasetReportValues, previewStockReport } from '../api/reportsApi'
import { profitDayDataset, profitSupplierDataset } from '../data/profitReadMode.test-fixtures'
import { currentVparivanieDataset } from '../data/currentVparivanie.test-fixtures'
import { cashModeDataset } from '../data/cashReadMode.test-fixtures'
import { settlementModeDataset } from '../data/settlementReadMode.test-fixtures'
import { netDataset, grossDataset } from '../data/reportDatasets.test-fixtures'
import { salesByResponsiblesDataset } from '../data/salesByResponsibles.test-fixtures'
import { findOpenedWorkbook } from '../testing/workbookDesk'
import { ReportsStocksPage } from './ReportsStocksPage'

const auth = vi.hoisted(() => ({ allowed: true }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => auth.allowed }) }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  searchDatasetReportValues: vi.fn(), previewStockReport: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); auth.allowed = true
  vi.mocked(getReportDatasets).mockResolvedValue([profitDayDataset, profitSupplierDataset, currentVparivanieDataset,
    cashModeDataset, settlementModeDataset, salesByResponsiblesDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
})

function page() {
  return <MantineProvider env="test"><I18nProvider><PageHeaderActionsProvider>
    <PageSubmenuActionsSlot className="test-header-strip" /><ReportsStocksPage consoleScope />
  </PageHeaderActionsProvider></I18nProvider></MantineProvider>
}

it('renders exactly the five requested report groups in the header strip', async () => {
  const view = render(page())
  await findOpenedWorkbook('ВП.xls')
  const strip = view.container.querySelector('.test-header-strip')!
  expect(within(strip as HTMLElement).getAllByRole('button').map(button => button.textContent)).toEqual([
    'Продажі', 'Залишки', 'Закупи', 'Грошові кошти', 'Особливі звіти',
  ])
  expect(within(strip as HTMLElement).queryByRole('button', { name: 'Чернетка' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Шаблони' })).toBeTruthy()
})

it('opens both sales choices through the real report page and retains the supplier workbook', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([profitDayDataset, profitSupplierDataset, { ...netDataset, reportProfiles: ['sales', 'grossProfit'], Groupings: grossDataset.Groupings }])
  render(page())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Відкрити Звіт по продажам' }).getAttribute('aria-current')).toBe('true'))
  fireEvent.click(screen.getByRole('button', { name: 'Продажі' }))
  expect((await screen.findAllByRole('menuitem')).map(item => item.textContent)).toEqual(['Звіт по продажам', 'Валовий прибуток'])
  fireEvent.click(screen.getByRole('menuitem', { name: 'Звіт по продажам' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Відкрити Звіт по продажам' }).getAttribute('aria-current')).toBe('true'))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Продажі' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Продажі' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Валовий прибуток' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Відкрити Валовий прибуток' }).getAttribute('aria-current')).toBe('true'))
  expect(screen.getByRole('button', { name: 'Відкрити ВП по постачальниках.xls' })).toBeTruthy()
  expect(previewStockReport).not.toHaveBeenCalled()
})

it('lists all five special reports and opens the available analysis without enabling restricted reports', async () => {
  render(page()); await findOpenedWorkbook('ВП.xls')
  fireEvent.click(screen.getByRole('button', { name: 'Особливі звіти' }))
  const items = await screen.findAllByRole('menuitem')
  expect(items.map(item => item.textContent)).toEqual(['Аналіз залишків і продажів', 'Звіт повернення', 'Звіт по скидкам клієнтів',
    'Продажі порівнянням по групам цін', 'Порівняння роботи клієнтів'])
  for (const item of items.slice(1)) expect(item.getAttribute('data-disabled')).toBeTruthy()
  fireEvent.click(items[0])
  await findOpenedWorkbook('Впарювання.xls')
  expect(screen.getByRole('button', { name: 'Особливі звіти' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Грошові кошти' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Відомість по коштах' }))
  await findOpenedWorkbook('Ведомость по денежным средствам.xls')
})

it('opens all three cash reports from the header menu and marks the selected form', async () => {
  render(page()); await findOpenedWorkbook('ВП.xls')
  const reports = [
    ['Відомість по коштах', 'Ведомость по денежным средствам.xls'],
    ['Взаєморозрахунки всі', 'Взаємороз всі.xls'],
    ['Дебіторська заборгованість', 'ДБіторка.xls'],
  ]
  for (const [label, file] of reports) {
    const cash = screen.getByRole('button', { name: 'Грошові кошти' })
    await waitFor(() => expect((cash as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(cash)
    const items = await screen.findAllByRole('menuitem')
    expect(items.map(item => item.textContent)).toEqual(reports.map(([name]) => name))
    fireEvent.click(screen.getByRole('menuitem', { name: label }))
    await findOpenedWorkbook(file)
    expect(cash.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Продажі' }).getAttribute('aria-pressed')).toBe('false')
    await waitFor(() => expect((cash as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(cash)
    expect((await screen.findByRole('menuitem', { name: label })).getAttribute('aria-current')).toBe('page')
    fireEvent.click(screen.getByRole('menuitem', { name: label }))
  }
  expect(previewStockReport).not.toHaveBeenCalled()
})

it('keeps settlement reports available when the cash dataset is missing', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([profitDayDataset, settlementModeDataset])
  render(page()); await findOpenedWorkbook('ВП.xls')
  fireEvent.click(screen.getByRole('button', { name: 'Грошові кошти' }))
  expect((await screen.findByRole('menuitem', { name: 'Відомість по коштах' })).getAttribute('data-disabled')).toBeTruthy()
  expect(screen.getByText('Звіт ще не доступний у поточному каталозі.')).toBeTruthy()
  fireEvent.click(screen.getByRole('menuitem', { name: 'Взаєморозрахунки всі' }))
  await findOpenedWorkbook('Взаємороз всі.xls')
})

it('keeps navigation visible but blocks report launches when permission is absent', async () => {
  auth.allowed = false
  render(page())
  const nav = screen.getByRole('navigation', { name: 'Розділи звітів' })
  expect(within(nav).getAllByRole('button')).toHaveLength(5)
  for (const button of within(nav).getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true)
  expect(getReportDatasets).not.toHaveBeenCalled()
  expect(previewStockReport).not.toHaveBeenCalled()
})
