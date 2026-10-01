import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getCurrencyRateDynamicsCapabilities, getCurrencyRateDynamicsDefinitions, previewCurrencyRateDynamics } from '../api/currencyRateDynamicsApi'
import { createStockReport } from '../api/reportsApi'
import { getReportCatalogue, getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { currencyDynamicsCapability, currencyDynamicsCatalogueEntry, currencyDynamicsDefinition, currencyDynamicsReport } from '../data/currencyRateDynamics.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import type { ReportCatalogue } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { NetUid: 'currency-dynamics-test-owner' }, hasPermission: () => true }) }))
vi.mock('../api/currencyRateDynamicsApi', () => ({ getCurrencyRateDynamicsCapabilities: vi.fn(), getCurrencyRateDynamicsDefinitions: vi.fn(), previewCurrencyRateDynamics: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportCatalogue: vi.fn(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(),
}))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))

function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear()
  const catalogue: ReportCatalogue = { CapturedOn: '2026-09-07', Presentations: [], Reports: [currencyDynamicsCatalogueEntry()] }
  vi.mocked(getReportCatalogue).mockResolvedValue(catalogue)
  vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets)
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(getCurrencyRateDynamicsCapabilities).mockResolvedValue(currencyDynamicsCapability())
  vi.mocked(getCurrencyRateDynamicsDefinitions).mockResolvedValue([currencyDynamicsDefinition()])
  vi.mocked(previewCurrencyRateDynamics).mockResolvedValue(currencyDynamicsReport())
})

it('launches the original rate form with exact OUR pair and no native request or draft mutation', async () => {
  render(<Providers><ReportsStocksPage constructorMode /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  const draftKey = 'report-workspace-draft:v1:currency-dynamics-test-owner'
  const draft = sessionStorage.getItem(draftKey)
  fireEvent.click(screen.getByRole('button', { name: 'Каталог усіх звітів 1С' }))
  const open = await screen.findByRole('button', { name: 'Відкрити оригінальний конструктор' })
  await waitFor(() => expect((open as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(open)
  const original = await screen.findByRole('dialog', { name: currencyDynamicsCapability().Title })
  const month = within(original).getByLabelText('Період')
  expect((month as HTMLInputElement).type).toBe('month')
  const pair = within(original).getByRole('combobox', { name: 'Валюта' })
  fireEvent.click(pair)
  fireEvent.click(await screen.findByRole('option', { name: /USD.*UAH/ }))
  expect(within(original).queryByLabelText('Від')).toBeNull()
  expect(within(original).queryByLabelText('До')).toBeNull()
  fireEvent.change(month, { target: { value: '2026-09' } })
  fireEvent.click(within(original).getByRole('button', { name: 'Переглянути' }))
  await screen.findByRole('region', { name: 'Результат динаміки курсу базової валюти' })
  expect(previewCurrencyRateDynamics).toHaveBeenCalledWith(currencyDynamicsCapability(), '2026-09', currencyDynamicsDefinition())
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
  await screen.findByRole('dialog', { name: currencyDynamicsCapability().Title })
  expect(getCurrencyRateDynamicsCapabilities).toHaveBeenCalled()
  expect(createStockReport).not.toHaveBeenCalled()
})
