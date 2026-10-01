import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { getCashPeriodLegs } from '../api/cashPeriodApi'
import { cashPeriodDataset, cashPeriodLeg, cashPeriodScope, cashPeriodManagementDataset,
  cashPeriodManagementScope } from '../data/cashPeriod.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { groupedCashDataset } from '../data/groupedCashPeriod.test-fixtures'
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

it('selects eight server-supported columns and switches to four while preserving exact account identity', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, cashPeriodManagementDataset])
  const { container } = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByText('Часткові форми за зразками Excel'))
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити часткову форму: Рух коштів за період' }))
  fireEvent.click(await screen.findByRole('combobox', { name: 'Рахунок і власна валюта' }))
  fireEvent.click(await screen.findByRole('option', { name: /Synthetic organization/ }))
  expect((screen.getByRole('combobox', { name: 'Валюти показників' }) as HTMLInputElement).value)
    .toBe('Валюта рахунку та управлінська — 8 показників')
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  const first = vi.mocked(createStockReport).mock.calls[0][0]
  expect(first.cashPeriod).toEqual(cashPeriodManagementScope)
  expect(first.sorted.Measurements.map(item => item.Type)).toEqual([84, 85, 86, 87, 92, 93, 94, 95])
  fireEvent.click(screen.getByRole('combobox', { name: 'Валюти показників' }))
  fireEvent.click(screen.getByRole('option', { name: 'Валюта рахунку — 4 показники' }))
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
  const second = vi.mocked(createStockReport).mock.calls[1][0]
  expect(second.cashPeriod).toEqual(cashPeriodScope)
  expect(second.sorted.Measurements.map(item => item.Type)).toEqual([84, 85, 86, 87])
  expect(screen.queryByText(/Структура звіту руху коштів фіксована/)).toBeNull()
})

it('opens the multi-account workbook only with its capability and submits eight columns without a fabricated leg', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, groupedCashDataset])
  const { container } = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByText('Часткові форми за зразками Excel'))
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити часткову форму: Рух коштів за період' }))
  expect(screen.queryByRole('combobox', { name: 'Рахунок і власна валюта' })).toBeNull()
  expect((screen.getByLabelText('Усі / вибрані рахунки') as HTMLInputElement).checked).toBe(true)
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  const data = vi.mocked(createStockReport).mock.calls[0][0]
  expect(data.groupedCashPeriod).toEqual({ Version: 1, CurrencyBasis: 'AccountAndManagementCurrency' })
  expect(data.cashPeriod).toBeUndefined(); expect(data.selections).toEqual([])
  expect(data.sorted.Measurements.map(x => x.Type)).toEqual([84, 85, 86, 87, 92, 93, 94, 95])
  expect(getCashPeriodLegs).not.toHaveBeenCalled()
})
it('changes from grouped accounts to exact account without retaining either grouped scope or its filters', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, groupedCashDataset])
  const { container } = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByText('Часткові форми за зразками Excel'))
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити часткову форму: Рух коштів за період' }))
  fireEvent.click(screen.getByLabelText('Один валютний запис'))
  fireEvent.click(await screen.findByRole('combobox', { name: 'Рахунок і власна валюта' }))
  fireEvent.click(await screen.findByRole('option', { name: /Synthetic organization/ }))
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  const data = vi.mocked(createStockReport).mock.calls[0][0]
  expect(data.groupedCashPeriod).toBeUndefined(); expect(data.cashPeriod).toEqual(cashPeriodManagementScope)
  expect(data.selections).toEqual([])
})
