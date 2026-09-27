import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { getSettlementPeriodAgreements } from '../api/settlementPeriodApi'
import { settlementPeriodDataset, settlementPeriodAgreement, settlementPeriodScope } from '../data/settlementPeriod.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { previousKyivDay } from '../data/cashPeriod'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/settlementPeriodApi', () => ({ getSettlementPeriodAgreements: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, settlementPeriodDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(getSettlementPeriodAgreements).mockResolvedValue([settlementPeriodAgreement])
  vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
})

it('selects explicit world/family, a completed Kyiv day and exact agreement with fixed settlement-currency shape', async () => {
  const { container } = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
  fireEvent.click(await screen.findByRole('option', { name: settlementPeriodDataset.Name }))
  expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe(previousKyivDay(formatKyivBusinessDate()))
  expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe(previousKyivDay(formatKyivBusinessDate()))
  expect(getSettlementPeriodAgreements).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('combobox', { name: 'База обліку договору' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Fenix' }))
  expect(getSettlementPeriodAgreements).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('combobox', { name: 'Тип договору' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Договір контрагента' }))
  fireEvent.click(await screen.findByRole('combobox', { name: 'Договір і валюта взаєморозрахунків' }))
  fireEvent.click(await screen.findByRole('option', { name: /Synthetic organization/ }))
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  const request = vi.mocked(createStockReport).mock.calls[0][0]
  expect(request).toMatchObject({ dataSource: 41, settlementPeriod: settlementPeriodScope, selections: [],
    sorted: { Row: [{ type: 4 }, { type: 41 }, { type: 76 }, { type: 77 }], Col: [],
      Measurements: [{ Type: 88 }, { Type: 89 }, { Type: 90 }, { Type: 91 }] } })
  expect(Object.keys(request.settlementPeriod as Record<string, unknown>).sort()).toEqual([
    'AgreementId', 'AgreementNetUid', 'CurrencyBasis', 'NativeFamily', 'SourceWorld', 'Version',
  ])
  fireEvent.click(screen.getByRole('button', { name: 'Скинути' }))
  expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe(previousKyivDay(formatKyivBusinessDate()))
  expect((screen.getByRole('combobox', { name: 'База обліку договору' }) as HTMLInputElement).value).toBe('')
  expect((screen.getByRole('combobox', { name: 'Тип договору' }) as HTMLInputElement).value).toBe('')
  expect(screen.queryByRole('combobox', { name: 'Договір і валюта взаєморозрахунків' })).toBeNull()
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
})


it('does not expose dedicated controls when the server does not advertise dataset 41', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets)
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
  expect(screen.queryByRole('option', { name: settlementPeriodDataset.Name })).toBeNull()
  expect(screen.queryByRole('combobox', { name: 'База обліку договору' })).toBeNull()
  expect(getSettlementPeriodAgreements).not.toHaveBeenCalled()
})
