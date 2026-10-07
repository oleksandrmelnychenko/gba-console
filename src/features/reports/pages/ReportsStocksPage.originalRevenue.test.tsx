import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getOriginalRevenueCapabilities, previewOriginalRevenue } from '../api/originalRevenueApi'
import { createStockReport } from '../api/reportsApi'
import { getReportCatalogue, getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { defaultCurrencyRateDynamicsMonth } from '../data/currencyRateDynamics'
import { originalRevenueCapability, originalRevenueCatalogueEntry, originalRevenueReport } from '../data/originalRevenue.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import type { ReportCatalogue } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { NetUid: 'original-revenue-test-owner' }, hasPermission: () => true }) }))
vi.mock('../api/originalRevenueApi', () => ({ getOriginalRevenueCapabilities: vi.fn(), previewOriginalRevenue: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportCatalogue: vi.fn(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(),
}))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear()
  const catalogue: ReportCatalogue = { CapturedOn: '2026-09-07', Presentations: [], Reports: [originalRevenueCatalogueEntry()] }
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogue); vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets)
  vi.mocked(getServerReportTemplates).mockResolvedValue([]); vi.mocked(getOriginalRevenueCapabilities).mockResolvedValue(originalRevenueCapability())
  vi.mocked(previewOriginalRevenue).mockResolvedValue(originalRevenueReport())
})
it('launches original revenue with month only and dedicated rows without native32 requests or native draft mutations', async () => {
  render(<Providers><ReportsStocksPage consoleScope={false} constructorMode /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  const key = 'report-workspace-draft:v1:original-revenue-test-owner', before = sessionStorage.getItem(key)
  fireEvent.click(screen.getByRole('button', { name: 'Каталог усіх звітів 1С' }))
  const open = await screen.findByRole('button', { name: 'Відкрити оригінальний конструктор' })
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(open)
  const dialog = await screen.findByRole('dialog', { name: originalRevenueCapability().Title })
  const period = within(dialog).getByLabelText('Місяць') as HTMLInputElement
  expect(period.type).toBe('month'); expect(period.value).toBe(defaultCurrencyRateDynamicsMonth(formatKyivBusinessDate()))
  expect(within(dialog).queryByLabelText('Від')).toBeNull(); expect(within(dialog).queryByLabelText('До')).toBeNull()
  expect(within(dialog).queryByRole('combobox')).toBeNull()
  fireEvent.change(period, { target: { value: '2026-09' } }); fireEvent.click(within(dialog).getByRole('button', { name: 'Переглянути' }))
  await screen.findByRole('region', { name: 'Результат виручки' })
  expect(previewOriginalRevenue).toHaveBeenCalledWith(originalRevenueCapability(), '2026-09')
  expect(createStockReport).not.toHaveBeenCalled(); expect(sessionStorage.getItem(key)).toBe(before)
})
it('uses its dedicated capability even while native dataset catalogue loading fails', async () => {
  vi.mocked(getReportDatasets).mockRejectedValue(new Error('Native datasets unavailable'))
  render(<Providers><ReportsStocksPage consoleScope={false} constructorMode /></Providers>)
  const catalogue = await screen.findByRole('button', { name: 'Каталог усіх звітів 1С' })
  expect(screen.getAllByText('Native datasets unavailable').length).toBeGreaterThan(0)
  fireEvent.click(catalogue)
  const open = await screen.findByRole('button', { name: 'Відкрити оригінальний конструктор' })
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(open)
  await screen.findByRole('dialog', { name: originalRevenueCapability().Title })
  expect(getOriginalRevenueCapabilities).toHaveBeenCalled(); expect(createStockReport).not.toHaveBeenCalled()
})
