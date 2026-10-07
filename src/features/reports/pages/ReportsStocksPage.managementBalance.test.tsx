import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { saveSession } from '../../../shared/auth/session'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getManagementBalanceCapabilities, previewManagementBalance } from '../api/managementBalanceApi'
import { createStockReport } from '../api/reportsApi'
import { getReportCatalogue, getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { MANAGEMENT_BALANCE_TEST_CALLER, managementBalanceCapability, managementBalanceCatalogueEntry, managementBalanceReport } from '../data/managementBalance.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import type { ReportCatalogue } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { NetUid: '11111111-1111-1111-1111-111111111111' }, hasPermission: () => true }) }))
vi.mock('../api/managementBalanceApi', () => ({ getManagementBalanceCapabilities: vi.fn(), previewManagementBalance: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportCatalogue: vi.fn(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear(); saveSession({ userNetUid: MANAGEMENT_BALANCE_TEST_CALLER, csrfToken: 'balance-workspace' })
  const catalogue: ReportCatalogue = { CapturedOn: '2026-09-07', Presentations: [], Reports: [managementBalanceCatalogueEntry()] }
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogue); vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets)
  vi.mocked(getServerReportTemplates).mockResolvedValue([]); vi.mocked(getManagementBalanceCapabilities).mockResolvedValue(managementBalanceCapability())
  vi.mocked(previewManagementBalance).mockResolvedValue(managementBalanceReport())
})
async function openForm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Каталог усіх звітів 1С' }))
  const open = await screen.findByRole('button', { name: 'Відкрити місячну дебіторку' })
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(open)
  return screen.findByRole('dialog', { name: managementBalanceCapability().ReportName })
}
function selectPeriod(modal: HTMLElement) {
  fireEvent.change(within(modal).getByLabelText('Місяць'), { target: { value: '2026-09' } })
}
it('defers capability until catalogue opening and keeps the explicit balance month outside the native workspace draft', async () => {
  render(<Providers><ReportsStocksPage consoleScope={false} constructorMode /></Providers>); await screen.findByRole('button', { name: 'Продажі за днями' })
  expect(getManagementBalanceCapabilities).not.toHaveBeenCalled(); expect(getReportCatalogue).not.toHaveBeenCalled()
  const from = (screen.getByLabelText('Від') as HTMLInputElement).value, through = (screen.getByLabelText('До') as HTMLInputElement).value
  const draftKey = `report-workspace-draft:v1:${MANAGEMENT_BALANCE_TEST_CALLER}`, draft = sessionStorage.getItem(draftKey)
  const modal = await openForm(); selectPeriod(modal)
  expect((within(modal).getByLabelText('Місяць') as HTMLInputElement).type).toBe('month')
  expect(within(modal).queryByRole('combobox')).toBeNull(); expect(within(modal).queryByLabelText('Від')).toBeNull()
  fireEvent.click(within(modal).getByRole('button', { name: 'Переглянути' })); await within(modal).findByRole('region', { name: 'Результат управлінської заборгованості' })
  expect(previewManagementBalance).toHaveBeenCalledWith(managementBalanceCapability(), '2026-09', MANAGEMENT_BALANCE_TEST_CALLER, expect.any(AbortSignal))
  expect(createStockReport).not.toHaveBeenCalled(); expect(sessionStorage.getItem(draftKey)).toBe(draft)
  fireEvent.click(within(modal).getByRole('button', { name: 'Закрити заборгованість' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: managementBalanceCapability().ReportName })).toBeNull())
  expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe(from); expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe(through)
})
it('opens the original form with genuine capability even when the native numeric dataset catalogue is unavailable', async () => {
  vi.mocked(getReportDatasets).mockRejectedValue(new Error('Native datasets unavailable')); render(<Providers><ReportsStocksPage consoleScope={false} constructorMode /></Providers>)
  const modal = await openForm(); selectPeriod(modal); fireEvent.click(within(modal).getByRole('button', { name: 'Переглянути' }))
  await within(modal).findByRole('region', { name: 'Результат управлінської заборгованості' }); expect(createStockReport).not.toHaveBeenCalled()
  expect(sessionStorage.getItem(`report-workspace-draft:v1:${MANAGEMENT_BALANCE_TEST_CALLER}`)).toBeNull()
})

it('opens the distinct original quarterly payables form without changing native draft data', async () => {
  vi.mocked(getReportCatalogue).mockResolvedValue({ CapturedOn: '2026-09-07', Presentations: [], Reports: [managementBalanceCatalogueEntry('quarterlyManagementPayables')] })
  vi.mocked(getManagementBalanceCapabilities).mockResolvedValue(managementBalanceCapability('quarterlyManagementPayables'))
  vi.mocked(previewManagementBalance).mockResolvedValue(managementBalanceReport('quarterlyManagementPayables'))
  render(<Providers><ReportsStocksPage consoleScope={false} constructorMode /></Providers>)
  fireEvent.click(await screen.findByRole('button', { name: 'Каталог усіх звітів 1С' }))
  const button = await screen.findByRole('button', { name: 'Відкрити квартальну управлінську кредиторку' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(button)
  const modal = await screen.findByRole('dialog', { name: managementBalanceCapability('quarterlyManagementPayables').ReportName })
  fireEvent.change(within(modal).getByLabelText('Квартал'), { target: { value: '2026-Q3' } })
  expect(within(modal).queryByLabelText('Місяць')).toBeNull(); expect(within(modal).queryByRole('combobox')).toBeNull()
  fireEvent.click(within(modal).getByRole('button', { name: 'Переглянути' })); await within(modal).findByRole('region', { name: 'Результат управлінської заборгованості' })
  expect(getManagementBalanceCapabilities).toHaveBeenCalledWith('quarterlyManagementPayables', MANAGEMENT_BALANCE_TEST_CALLER, expect.any(AbortSignal))
  expect(previewManagementBalance).toHaveBeenCalledWith(managementBalanceCapability('quarterlyManagementPayables'), '2026-Q3', MANAGEMENT_BALANCE_TEST_CALLER, expect.any(AbortSignal))
  expect(createStockReport).not.toHaveBeenCalled()
})
