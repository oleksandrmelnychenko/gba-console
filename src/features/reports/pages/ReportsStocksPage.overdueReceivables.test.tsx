import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getOverdueReceivablesCapabilities, previewOverdueReceivables } from '../api/overdueReceivablesApi'
import { createStockReport } from '../api/reportsApi'
import { getReportCatalogue, getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { overdueReceivablesCapability, overdueReceivablesCatalogueEntry, overdueReceivablesReport } from '../data/overdueReceivables.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import type { ReportCatalogue } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { NetUid: 'overdue-receivables-test-owner' }, hasPermission: () => true }) }))
vi.mock('../api/overdueReceivablesApi', () => ({ getOverdueReceivablesCapabilities: vi.fn(), previewOverdueReceivables: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportCatalogue: vi.fn(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(),
}))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))

function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}

beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear()
  const catalogue: ReportCatalogue = { CapturedOn: '2026-09-07', Presentations: [], Reports: [overdueReceivablesCatalogueEntry()] }
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogue)
  vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets)
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(getOverdueReceivablesCapabilities).mockResolvedValue(overdueReceivablesCapability())
  vi.mocked(previewOverdueReceivables).mockResolvedValue(overdueReceivablesReport())
})

it('defers the capability until catalogue opening and keeps the monthly request outside the native draft', async () => {
  render(<Providers><ReportsStocksPage consoleScope={false} constructorMode /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  expect(getOverdueReceivablesCapabilities).not.toHaveBeenCalled()
  expect(getReportCatalogue).not.toHaveBeenCalled()
  const from = (screen.getByLabelText('Від') as HTMLInputElement).value
  const through = (screen.getByLabelText('До') as HTMLInputElement).value
  const draftKey = 'report-workspace-draft:v1:overdue-receivables-test-owner'
  const draft = sessionStorage.getItem(draftKey)
  fireEvent.click(screen.getByRole('button', { name: 'Каталог усіх звітів 1С' }))
  // The first catalogue opening loads its lazy module before the capability action exists.
  const open = await screen.findByRole('button', { name: 'Відкрити прострочену дебіторку' }, { timeout: 5000 })
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(open)
  const modal = await screen.findByRole('dialog', { name: overdueReceivablesCapability().ReportName })
  const month = within(modal).getByLabelText('Період')
  expect((month as HTMLInputElement).type).toBe('month')
  expect(within(modal).queryByRole('combobox')).toBeNull()
  expect(within(modal).queryByLabelText('Від')).toBeNull()
  expect(within(modal).queryByLabelText('До')).toBeNull()
  fireEvent.change(month, { target: { value: '2026-09' } })
  fireEvent.click(within(modal).getByRole('button', { name: 'Переглянути' }))
  await within(modal).findByRole('region', { name: 'Результат простроченої дебіторки' })
  expect(previewOverdueReceivables).toHaveBeenCalledWith(overdueReceivablesCapability(), '2026-09', expect.any(AbortSignal))
  expect(createStockReport).not.toHaveBeenCalled()
  expect(sessionStorage.getItem(draftKey)).toBe(draft)
  fireEvent.click(within(modal).getByRole('button', { name: 'Закрити прострочену дебіторку' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: overdueReceivablesCapability().ReportName })).toBeNull())
  expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe(from)
  expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe(through)
})

it('opens the dedicated monthly report when the native numeric dataset catalogue is unavailable', async () => {
  vi.mocked(getReportDatasets).mockRejectedValue(new Error('Native datasets unavailable'))
  render(<Providers><ReportsStocksPage consoleScope={false} constructorMode /></Providers>)
  const catalogue = await screen.findByRole('button', { name: 'Каталог усіх звітів 1С' })
  expect(screen.getAllByText('Native datasets unavailable').length).toBeGreaterThan(0)
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(getOverdueReceivablesCapabilities).not.toHaveBeenCalled()
  fireEvent.click(catalogue)
  const open = await screen.findByRole('button', { name: 'Відкрити прострочену дебіторку' })
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(open)
  const modal = await screen.findByRole('dialog', { name: overdueReceivablesCapability().ReportName })
  fireEvent.change(within(modal).getByLabelText('Період'), { target: { value: '2026-09' } })
  fireEvent.click(within(modal).getByRole('button', { name: 'Переглянути' }))
  await within(modal).findByRole('region', { name: 'Результат простроченої дебіторки' })
  expect(createStockReport).not.toHaveBeenCalled()
  expect(sessionStorage.getItem('report-workspace-draft:v1:overdue-receivables-test-owner')).toBeNull()
})
