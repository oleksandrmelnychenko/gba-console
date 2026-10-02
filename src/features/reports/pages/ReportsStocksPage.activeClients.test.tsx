import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { clearSession, saveSession } from '../../../shared/auth/session'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getActiveClientsCapabilities, previewActiveClients } from '../api/activeClientsApi'
import { createStockReport } from '../api/reportsApi'
import { getReportCatalogue, getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { activeClientsCapability, activeClientsCatalogueEntry, activeClientsReport } from '../data/activeClients.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import type { ReportCatalogue } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { NetUid: 'active-clients-test-owner' }, hasPermission: () => true }) }))
vi.mock('../api/activeClientsApi', () => ({ getActiveClientsCapabilities: vi.fn(), previewActiveClients: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportCatalogue: vi.fn(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(),
}))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))

function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}

beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear()
  saveSession({ userNetUid: 'active-clients-test-owner', csrfToken: 'active-clients-fixture-csrf' })
  const catalogue: ReportCatalogue = { CapturedOn: '2026-09-07', Presentations: [], Reports: [activeClientsCatalogueEntry()] }
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogue)
  vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets)
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(getActiveClientsCapabilities).mockResolvedValue(activeClientsCapability())
  vi.mocked(previewActiveClients).mockResolvedValue(activeClientsReport())
})
afterEach(clearSession)

it('launches the original count form without borrowing native filters, request or draft state', async () => {
  render(<Providers><ReportsStocksPage constructorMode /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  const draftKey = 'report-workspace-draft:v1:active-clients-test-owner'
  const draft = sessionStorage.getItem(draftKey)
  fireEvent.click(screen.getByRole('button', { name: 'Каталог усіх звітів 1С' }))
  const open = await screen.findByRole('button', { name: 'Відкрити оригінальний конструктор' })
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(open)
  const original = await screen.findByRole('dialog', { name: activeClientsCapability().Title })
  const month = within(original).getByLabelText('Період')
  expect((month as HTMLInputElement).type).toBe('month')
  expect(within(original).queryByRole('combobox')).toBeNull()
  expect(within(original).queryByLabelText('Від')).toBeNull()
  expect(within(original).queryByLabelText('До')).toBeNull()
  fireEvent.change(month, { target: { value: '2026-09' } })
  fireEvent.click(within(original).getByRole('button', { name: 'Переглянути' }))
  await screen.findByRole('region', { name: 'Результат кількості активних клієнтів' })
  expect(previewActiveClients).toHaveBeenCalledWith(activeClientsCapability(), '2026-09')
  expect(createStockReport).not.toHaveBeenCalled()
  expect(sessionStorage.getItem(draftKey)).toBe(draft)
})

it('can launch using its own server capability when the numeric dataset catalogue is unavailable', async () => {
  vi.mocked(getReportDatasets).mockRejectedValue(new Error('Native datasets unavailable'))
  render(<Providers><ReportsStocksPage constructorMode /></Providers>)
  const catalogue = await screen.findByRole('button', { name: 'Каталог усіх звітів 1С' })
  expect(screen.getAllByText('Native datasets unavailable').length).toBeGreaterThan(0)
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(catalogue)
  const open = await screen.findByRole('button', { name: 'Відкрити оригінальний конструктор' })
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(open)
  await screen.findByRole('dialog', { name: activeClientsCapability().Title })
  expect(getActiveClientsCapabilities).toHaveBeenCalled()
  expect(createStockReport).not.toHaveBeenCalled()
})
