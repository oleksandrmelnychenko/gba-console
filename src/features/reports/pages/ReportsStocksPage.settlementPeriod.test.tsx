import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { settlementPeriodDataset } from '../data/settlementPeriod.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, settlementPeriodDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
})

it('offers no exact-agreement or Fenix/AMG base controls for the settlement workbook', async () => {
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити Взаємороз всі.xls' }))
  expect((screen.getByRole('combobox', { name: 'Звіт' }) as HTMLInputElement).value).toBe(settlementPeriodDataset.Name)
  expect(screen.queryByRole('combobox', { name: 'База обліку договору' })).toBeNull()
  expect(screen.queryByRole('combobox', { name: 'Тип договору' })).toBeNull()
})

it('does not expose dedicated controls when the server does not advertise dataset 41', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets)
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  expect(screen.queryByText('Звіти 1С за зразками Excel')).toBeNull()
  fireEvent.click(screen.getByRole('combobox', { name: 'Звіт' }))
  expect(screen.queryByRole('option', { name: settlementPeriodDataset.Name })).toBeNull()
  expect(screen.queryByRole('combobox', { name: 'База обліку договору' })).toBeNull()
})
