import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { saveSession } from '../../../shared/auth/session'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getManagementOrdersCapabilities, previewManagementOrders } from '../api/managementOrdersApi'
import { createStockReport } from '../api/reportsApi'
import { getReportCatalogue, getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { MANAGEMENT_ORDERS_TEST_CALLER, managementOrdersCapability, managementOrdersCatalogueEntry, managementOrdersReport, managementOrdersMissingReport } from '../data/managementOrders.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import type { ReportCatalogue } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { NetUid: '11111111-1111-1111-1111-111111111111' }, hasPermission: () => true }) }))
vi.mock('../api/managementOrdersApi', () => ({ getManagementOrdersCapabilities: vi.fn(), previewManagementOrders: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportCatalogue: vi.fn(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear(); saveSession({ userNetUid: MANAGEMENT_ORDERS_TEST_CALLER, csrfToken: 'orders-workspace' })
  const catalogue: ReportCatalogue = { CapturedOn: '2026-09-07', Presentations: [], Reports: [managementOrdersCatalogueEntry()] }
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogue); vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets)
  vi.mocked(getServerReportTemplates).mockResolvedValue([]); vi.mocked(getManagementOrdersCapabilities).mockResolvedValue(managementOrdersCapability())
  vi.mocked(previewManagementOrders).mockResolvedValue(managementOrdersReport())
})
async function openForm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Каталог усіх звітів 1С' }))
  const open = await screen.findByRole('button', { name: 'Відкрити оригінальні замовлення' })
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(open)
  return screen.findByRole('dialog', { name: managementOrdersCapability().ReportName })
}
function selectMonth(modal:HTMLElement) {fireEvent.change(within(modal).getByLabelText('Місяць'),{target:{value:'2026-09'}})}
it('defers capability until catalogue opening and keeps the monthly order scope outside the native workspace draft', async () => {
  render(<Providers><ReportsStocksPage consoleScope={false} constructorMode /></Providers>); await screen.findByRole('button', { name: 'Продажі за днями' })
  expect(getManagementOrdersCapabilities).not.toHaveBeenCalled(); expect(getReportCatalogue).not.toHaveBeenCalled()
  const from = (screen.getByLabelText('Від') as HTMLInputElement).value, through = (screen.getByLabelText('До') as HTMLInputElement).value
  const draftKey = `report-workspace-draft:v1:${MANAGEMENT_ORDERS_TEST_CALLER}`, draft = sessionStorage.getItem(draftKey)
  const modal = await openForm(); selectMonth(modal)
  expect((within(modal).getByLabelText('Місяць') as HTMLInputElement).type).toBe('month')
  expect(within(modal).queryByRole('combobox')).toBeNull(); expect(within(modal).queryByLabelText('Від')).toBeNull()
  fireEvent.click(within(modal).getByRole('button', { name: 'Переглянути' })); await within(modal).findByRole('region', { name: 'Результат оригінальних замовлень' })
  expect(previewManagementOrders).toHaveBeenCalledWith(managementOrdersCapability(), '2026-09', MANAGEMENT_ORDERS_TEST_CALLER, expect.any(AbortSignal))
  expect(createStockReport).not.toHaveBeenCalled(); expect(sessionStorage.getItem(draftKey)).toBe(draft)
  fireEvent.click(within(modal).getByRole('button', { name: 'Закрити звіт замовлень' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: managementOrdersCapability().ReportName })).toBeNull())
  expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe(from); expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe(through)
})
it('opens the original form with genuine capability even when the native numeric dataset catalogue is unavailable', async () => {
  vi.mocked(getReportDatasets).mockRejectedValue(new Error('Native datasets unavailable')); render(<Providers><ReportsStocksPage consoleScope={false} constructorMode /></Providers>)
  const modal = await openForm(); selectMonth(modal); fireEvent.click(within(modal).getByRole('button', { name: 'Переглянути' }))
  await within(modal).findByRole('region', { name: 'Результат оригінальних замовлень' }); expect(createStockReport).not.toHaveBeenCalled()
  expect(sessionStorage.getItem(`report-workspace-draft:v1:${MANAGEMENT_ORDERS_TEST_CALLER}`)).toBeNull()
})

it('shows normal publication pending without borrowing a native dataset or opening invented files',async()=>{
  vi.mocked(previewManagementOrders).mockResolvedValue(managementOrdersMissingReport());render(<Providers><ReportsStocksPage consoleScope={false} constructorMode/></Providers>)
  const modal=await openForm();selectMonth(modal);fireEvent.click(within(modal).getByRole('button',{name:'Переглянути'}))
  await within(modal).findByText(/Звіт неповний/);expect(createStockReport).not.toHaveBeenCalled()
  expect(within(modal).queryByText('У вибраних місяцях немає замовлень.')).toBeNull()
})
