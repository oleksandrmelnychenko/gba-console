import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getDebtToSalesRatioCapabilities, previewDebtToSalesRatio } from '../api/debtToSalesRatioApi'
import { createStockReport } from '../api/reportsApi'
import { getReportCatalogue, getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { debtRatioCapability, debtRatioCatalogueEntry, debtRatioReport } from '../data/debtToSalesRatio.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import type { ReportCatalogue } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { NetUid: 'debt-ratio-test-owner' }, hasPermission: () => true }) }))
vi.mock('../api/debtToSalesRatioApi', () => ({ getDebtToSalesRatioCapabilities: vi.fn(), previewDebtToSalesRatio: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportCatalogue: vi.fn(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(),
}))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))

function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}

beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear()
  const catalogue: ReportCatalogue = { CapturedOn: '2026-09-07', Presentations: [], Reports: [debtRatioCatalogueEntry()] }
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogue)
  vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets)
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(getDebtToSalesRatioCapabilities).mockResolvedValue(debtRatioCapability())
  vi.mocked(previewDebtToSalesRatio).mockResolvedValue(debtRatioReport())
})

it('opens the original constructor from the workspace catalogue without borrowing a native request or filters', async () => {
  render(<Providers><ReportsStocksPage constructorMode /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('button', { name: 'Каталог усіх звітів 1С' }))
  const open = await screen.findByRole('button', { name: 'Відкрити оригінальний конструктор' })
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(open)
  const month = await screen.findByLabelText('Період')
  expect((month as HTMLInputElement).type).toBe('month')
  fireEvent.change(month, { target: { value: '2026-09' } })
  const original = screen.getByRole('dialog', { name: debtRatioCapability().Title })
  expect(within(original).queryByRole('combobox')).toBeNull()
  expect(within(original).queryByLabelText('Від')).toBeNull()
  expect(within(original).queryByLabelText('До')).toBeNull()
  fireEvent.click(within(original).getByRole('button', { name: 'Переглянути' }))
  await screen.findByRole('region', { name: 'Результат оригінального конструктора' })
  expect(previewDebtToSalesRatio).toHaveBeenCalledWith(debtRatioCapability(), '2026-09')
  expect(createStockReport).not.toHaveBeenCalled()
})

it('keeps the original capability independent of an unavailable numeric dataset catalogue', async () => {
  vi.mocked(getReportDatasets).mockRejectedValue(new Error('Native datasets unavailable'))
  render(<Providers><ReportsStocksPage constructorMode /></Providers>)
  const catalogue = await screen.findByRole('button', { name: 'Каталог усіх звітів 1С' })
  expect(screen.getAllByText('Native datasets unavailable').length).toBeGreaterThan(0)
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByRole('region', { name: 'Незбережена чернетка' })).toBeNull()
  fireEvent.click(catalogue)
  const open = await screen.findByRole('button', { name: 'Відкрити оригінальний конструктор' })
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(open)
  await screen.findByRole('dialog', { name: debtRatioCapability().Title })
  expect(getDebtToSalesRatioCapabilities).toHaveBeenCalled()
  expect(createStockReport).not.toHaveBeenCalled()
})

it('preserves actual saved-draft recovery and bytes on dataset failure until explicitly discarded', async () => {
  const view = render(<Providers><ReportsStocksPage constructorMode /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.change(screen.getByLabelText('Від'), { target: { value: '' } })
  const key = 'report-workspace-draft:v1:debt-ratio-test-owner'
  await waitFor(() => expect(sessionStorage.getItem(key)).not.toBeNull())
  const saved = sessionStorage.getItem(key)
  view.unmount()
  vi.mocked(getReportDatasets).mockRejectedValue(new Error('Native datasets unavailable'))
  render(<Providers><ReportsStocksPage constructorMode /></Providers>)
  const recovery = await screen.findByRole('region', { name: 'Незбережена чернетка' })
  await within(recovery).findByText('Native datasets unavailable')
  expect((within(recovery).getByRole('button', { name: 'Відновити чернетку' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByRole('button', { name: 'Каталог усіх звітів 1С' })).toBeNull()
  expect(sessionStorage.getItem(key)).toBe(saved)
  fireEvent.click(within(recovery).getByRole('button', { name: 'Відкинути чернетку' }))
  const catalogue = await screen.findByRole('button', { name: 'Каталог усіх звітів 1С' })
  expect(sessionStorage.getItem(key)).toBeNull()
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(catalogue)
  const open = await screen.findByRole('button', { name: 'Відкрити оригінальний конструктор' })
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(open)
  await screen.findByRole('dialog', { name: debtRatioCapability().Title })
  expect(sessionStorage.getItem(key)).toBeNull()
  expect(createStockReport).not.toHaveBeenCalled()
})
