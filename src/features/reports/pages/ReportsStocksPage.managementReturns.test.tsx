import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { saveSession } from '../../../shared/auth/session'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getManagementReturnsCapabilities, previewManagementReturns } from '../api/managementReturnsApi'
import { createStockReport } from '../api/reportsApi'
import { getReportCatalogue, getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { initialManagementReturnsWindows } from '../data/managementReturns'
import { MANAGEMENT_RETURNS_TEST_CALLER, managementReturnsCapability, managementReturnsCatalogueEntry, managementReturnsReport } from '../data/managementReturns.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import type { ReportCatalogue } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { NetUid: '11111111-1111-1111-1111-111111111111' }, hasPermission: () => true }) }))
vi.mock('../api/managementReturnsApi', () => ({ getManagementReturnsCapabilities: vi.fn(), previewManagementReturns: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportCatalogue: vi.fn(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear(); saveSession({ userNetUid: MANAGEMENT_RETURNS_TEST_CALLER, csrfToken: 'returns-workspace' })
  const catalogue: ReportCatalogue = { CapturedOn: '2026-09-07', Presentations: [], Reports: [managementReturnsCatalogueEntry()] }
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogue); vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets)
  vi.mocked(getServerReportTemplates).mockResolvedValue([]); vi.mocked(getManagementReturnsCapabilities).mockResolvedValue(managementReturnsCapability())
  vi.mocked(previewManagementReturns).mockResolvedValue(managementReturnsReport())
})
async function openForm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Каталог усіх звітів 1С' }))
  const open = await screen.findByRole('button', { name: 'Відкрити управлінські повернення' })
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(open)
  return screen.findByRole('dialog', { name: managementReturnsCapability().ReportName })
}
function selectWindows(modal: HTMLElement) {
  const windows = initialManagementReturnsWindows('2026-09')
  for (const [label, value] of [['Поточний період: початок', windows.CurrentPeriod.From],
    ['Поточний період: виключна кінцева межа', windows.CurrentPeriod.ThroughExclusive],
    ['Попередній період: початок', windows.PreviousPeriod.From], ['Попередній період: виключна кінцева межа', windows.PreviousPeriod.ThroughExclusive]])
    fireEvent.change(within(modal).getByLabelText(label), { target: { value } })
}
it('defers capability until catalogue opening and keeps the two local windows outside the native workspace draft', async () => {
  render(<Providers><ReportsStocksPage consoleScope={false} constructorMode /></Providers>); await screen.findByRole('button', { name: 'Продажі за днями' })
  expect(getManagementReturnsCapabilities).not.toHaveBeenCalled(); expect(getReportCatalogue).not.toHaveBeenCalled()
  const from = (screen.getByLabelText('Від') as HTMLInputElement).value, through = (screen.getByLabelText('До') as HTMLInputElement).value
  const draftKey = `report-workspace-draft:v1:${MANAGEMENT_RETURNS_TEST_CALLER}`, draft = sessionStorage.getItem(draftKey)
  const modal = await openForm(); selectWindows(modal)
  expect((within(modal).getByLabelText('Поточний період: початок') as HTMLInputElement).type).toBe('datetime-local')
  expect(within(modal).queryByRole('combobox')).toBeNull(); expect(within(modal).queryByLabelText('Від')).toBeNull()
  fireEvent.click(within(modal).getByRole('button', { name: 'Переглянути' })); await within(modal).findByRole('region', { name: 'Результат управлінських повернень' })
  expect(previewManagementReturns).toHaveBeenCalledWith(managementReturnsCapability(), initialManagementReturnsWindows('2026-09'), MANAGEMENT_RETURNS_TEST_CALLER, expect.any(AbortSignal))
  expect(createStockReport).not.toHaveBeenCalled(); expect(sessionStorage.getItem(draftKey)).toBe(draft)
  fireEvent.click(within(modal).getByRole('button', { name: 'Закрити управлінські повернення' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: managementReturnsCapability().ReportName })).toBeNull())
  expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe(from); expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe(through)
})
it('opens the original form with genuine capability even when the native numeric dataset catalogue is unavailable', async () => {
  vi.mocked(getReportDatasets).mockRejectedValue(new Error('Native datasets unavailable')); render(<Providers><ReportsStocksPage consoleScope={false} constructorMode /></Providers>)
  const modal = await openForm(); selectWindows(modal); fireEvent.click(within(modal).getByRole('button', { name: 'Переглянути' }))
  await within(modal).findByRole('region', { name: 'Результат управлінських повернень' }); expect(createStockReport).not.toHaveBeenCalled()
  expect(sessionStorage.getItem(`report-workspace-draft:v1:${MANAGEMENT_RETURNS_TEST_CALLER}`)).toBeNull()
})
