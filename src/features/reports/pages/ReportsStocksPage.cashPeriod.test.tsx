import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { getCashPeriodLegs } from '../api/cashPeriodApi'
import { cashPeriodDataset, cashPeriodLeg } from '../data/cashPeriod.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { groupedCashDataset } from '../data/groupedCashPeriod.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/cashPeriodApi', () => ({ getCashPeriodLegs: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, cashPeriodDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(getCashPeriodLegs).mockResolvedValue([cashPeriodLeg])
  vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
})

it('opens the multi-account workbook only with its capability and submits eight columns without a fabricated leg', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, groupedCashDataset])
  const { container } = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити Ведомость по денежным средствам.xls' }))
  expect(screen.queryByRole('combobox', { name: 'Рахунок і власна валюта' })).toBeNull()
  expect(screen.queryByText('Один валютний запис')).toBeNull()
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  const data = vi.mocked(createStockReport).mock.calls[0][0]
  expect(data.groupedCashPeriod).toEqual({ Version: 1, CurrencyBasis: 'AccountAndManagementCurrency' })
  expect(data.cashPeriod).toBeUndefined(); expect(data.selections).toEqual([])
  expect(data.sorted.Measurements.map(x => x.Type)).toEqual([84, 85, 86, 87, 92, 93, 94, 95])
  expect(getCashPeriodLegs).not.toHaveBeenCalled()
})
