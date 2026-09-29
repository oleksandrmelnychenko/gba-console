import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { getCashPeriodLegs } from '../api/cashPeriodApi'
import { cashPeriodDataset, cashPeriodLeg, cashPeriodScope } from '../data/cashPeriod.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { previousKyivDay } from '../data/cashPeriod'
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

it('selects the completed Kyiv day, one exact leg and submits only fixed account-currency period scope', async () => {
  const { container } = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByText('Часткові форми за зразками Excel'))
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити часткову форму: Рух коштів за період' }))
  expect((screen.getByRole('combobox', { name: 'Набір даних звіту' }) as HTMLInputElement).value).toBe(cashPeriodDataset.Name)
  expect(screen.getAllByText(/Ведомость по денежным средствам.xls: Часткова форма Excel/).length).toBeGreaterThan(0)
  expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe(previousKyivDay(formatKyivBusinessDate()))
  expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe(previousKyivDay(formatKyivBusinessDate()))
  fireEvent.click(await screen.findByRole('combobox', { name: 'Рахунок і власна валюта' }))
  fireEvent.click(await screen.findByRole('option', { name: /Synthetic organization/ }))
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  const request = vi.mocked(createStockReport).mock.calls[0][0]
  expect(request).toMatchObject({ dataSource: 40, cashPeriod: cashPeriodScope, selections: [],
    sorted: { Row: [{ type: 43 }, { type: 40 }, { type: 42 }, { type: 41 }], Col: [],
      Measurements: [{ Type: 84 }, { Type: 85 }, { Type: 86 }, { Type: 87 }] } })
  expect(Object.keys(request.cashPeriod as Record<string, unknown>).sort()).toEqual([
    'CurrencyBasis', 'CurrencyRegisterId', 'CurrencyRegisterNetUid', 'Version',
  ])
  fireEvent.click(screen.getByRole('button', { name: 'Скинути' }))
  expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe(previousKyivDay(formatKyivBusinessDate()))
  expect(screen.queryByText(/Структура звіту руху коштів фіксована/)).toBeNull()
})
