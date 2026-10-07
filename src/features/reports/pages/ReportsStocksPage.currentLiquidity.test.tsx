import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { saveSession } from '../../../shared/auth/session'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getCurrentLiquidityCapabilities, previewCurrentLiquidity } from '../api/currentLiquidityApi'
import { createStockReport } from '../api/reportsApi'
import { getReportCatalogue, getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { CURRENT_LIQUIDITY_TEST_CALLER, currentLiquidityCapability, currentLiquidityCatalogueEntry, currentLiquidityReport, currentLiquidityMissingReport } from '../data/currentLiquidity.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import type { ReportCatalogue } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { NetUid: '11111111-1111-1111-1111-111111111111' }, hasPermission: () => true }) }))
vi.mock('../api/currentLiquidityApi', () => ({ getCurrentLiquidityCapabilities: vi.fn(), previewCurrentLiquidity: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportCatalogue: vi.fn(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear(); saveSession({ userNetUid: CURRENT_LIQUIDITY_TEST_CALLER, csrfToken: 'liquidity-workspace' })
  const catalogue: ReportCatalogue = { CapturedOn: '2026-09-07', Presentations: [], Reports: [currentLiquidityCatalogueEntry()] }
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogue); vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets)
  vi.mocked(getServerReportTemplates).mockResolvedValue([]); vi.mocked(getCurrentLiquidityCapabilities).mockResolvedValue(currentLiquidityCapability())
  vi.mocked(previewCurrentLiquidity).mockResolvedValue(currentLiquidityReport())
})
async function openForm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Каталог усіх звітів 1С' }))
  const open = await screen.findByRole('button', { name: 'Відкрити звіт поточної ліквідності' })
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(open)
  return screen.findByRole('dialog', { name: currentLiquidityCapability().ReportName })
}
function selectEndpoints(modal: HTMLElement) {
  fireEvent.change(within(modal).getByLabelText('Поточна дата'), { target: { value: '2026-10-01' } })
  fireEvent.change(within(modal).getByLabelText('Попередня дата'), { target: { value: '2026-09-01' } })
}
it('defers capability until catalogue opening and keeps the two-endpoint scalar scope outside the native workspace draft', async () => {
  render(<Providers><ReportsStocksPage consoleScope={false} constructorMode /></Providers>); await screen.findByRole('button', { name: 'Продажі за днями' })
  expect(getCurrentLiquidityCapabilities).not.toHaveBeenCalled(); expect(getReportCatalogue).not.toHaveBeenCalled()
  const from = (screen.getByLabelText('Від') as HTMLInputElement).value, through = (screen.getByLabelText('До') as HTMLInputElement).value
  const draftKey = `report-workspace-draft:v1:${CURRENT_LIQUIDITY_TEST_CALLER}`, draft = sessionStorage.getItem(draftKey)
  const modal = await openForm(); selectEndpoints(modal)
  expect((within(modal).getByLabelText('Поточна дата') as HTMLInputElement).type).toBe('date')
  expect(within(modal).queryByRole('combobox')).toBeNull(); expect(within(modal).queryByLabelText('Від')).toBeNull()
  fireEvent.click(within(modal).getByRole('button', { name: 'Переглянути' })); await within(modal).findByRole('region', { name: 'Результат поточної ліквідності' })
  expect(previewCurrentLiquidity).toHaveBeenCalledWith(currentLiquidityCapability(), '2026-10-01', '2026-09-01', CURRENT_LIQUIDITY_TEST_CALLER, expect.any(AbortSignal))
  expect(createStockReport).not.toHaveBeenCalled(); expect(sessionStorage.getItem(draftKey)).toBe(draft)
  fireEvent.click(within(modal).getByRole('button', { name: 'Закрити звіт поточної ліквідності' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: currentLiquidityCapability().ReportName })).toBeNull())
  expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe(from); expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe(through)
})
it('opens the original form with genuine capability even when the native numeric dataset catalogue is unavailable', async () => {
  vi.mocked(getReportDatasets).mockRejectedValue(new Error('Native datasets unavailable')); render(<Providers><ReportsStocksPage consoleScope={false} constructorMode /></Providers>)
  const modal = await openForm(); selectEndpoints(modal); fireEvent.click(within(modal).getByRole('button', { name: 'Переглянути' }))
  await within(modal).findByRole('region', { name: 'Результат поточної ліквідності' }); expect(createStockReport).not.toHaveBeenCalled()
  expect(sessionStorage.getItem(`report-workspace-draft:v1:${CURRENT_LIQUIDITY_TEST_CALLER}`)).toBeNull()
})

it('shows normal publication pending without borrowing a native dataset or opening invented files',async()=>{
  vi.mocked(previewCurrentLiquidity).mockResolvedValue(currentLiquidityMissingReport());render(<Providers><ReportsStocksPage consoleScope={false} constructorMode/></Providers>)
  const modal=await openForm();selectEndpoints(modal);fireEvent.click(within(modal).getByRole('button',{name:'Переглянути'}))
  await within(modal).findByText(/Дані синку ще не готові для формування повного звіту/);expect(createStockReport).not.toHaveBeenCalled()
  expect(within(modal).queryByText('За обрані періоди даних немає.')).toBeNull()
})
