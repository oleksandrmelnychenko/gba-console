import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, getOneCTurnoverScopes, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { grossDataset } from '../data/reportDatasets.test-fixtures'
import {
  PRICE_TYPE_ID,
  PRICE_TYPE_SCOPE,
  priceTypeSalesComparisonDataset,
} from '../data/priceTypeSalesComparison.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({
  ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(),
  getOneCTurnoverScopes: vi.fn(),
  searchDatasetReportValues: vi.fn(),
}))
vi.mock('../api/reportWorkspaceApi', async original => ({
  ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(),
  getServerReportTemplates: vi.fn(),
}))

function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}

const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
afterAll(() => {
  if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll)
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})

describe('source27 report constructor wire', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(getReportDatasets).mockResolvedValue([grossDataset, priceTypeSalesComparisonDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(getOneCTurnoverScopes).mockResolvedValue([{
      Key: 'A'.repeat(64), Filters: structuredClone(PRICE_TYPE_SCOPE), OrganizationNames: ['Організація Fenix'],
      FirstDay: '2026-01-01', LastDay: '2026-12-31', LoadedDayCount: 365,
      OldestReadCompletedUtc: '2026-01-01T00:00:00Z', NewestReadCompletedUtc: '2026-12-31T00:00:00Z',
    }])
    vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: PRICE_TYPE_ID, Name: 'Оптова глобальна' }])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
  })

  it('submits Fenix Version1 settings, explicit scope and Client → Product defaults', async () => {
    const { container } = render(<Providers><ReportsStocksPage constructorMode /></Providers>)
    await screen.findByRole('button', { name: 'Продажі за днями' })
    fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
    fireEvent.click(await screen.findByRole('option', { name: priceTypeSalesComparisonDataset.Name }))

    expect(screen.getByText(/не формує договірних рекомендацій/)).toBeTruthy()
    fireEvent.click(screen.getByRole('combobox', { name: 'Локальне покриття Fenix' }))
    fireEvent.click(await screen.findByRole('option', { name: /Організація Fenix/ }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Глобальний тип ціни Fenix' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Оптова глобальна' }))

    await waitFor(() => expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    const request = vi.mocked(createStockReport).mock.calls[0][0]
    expect(request).toMatchObject({
      dataSource: 27,
      oneC: PRICE_TYPE_SCOPE,
      priceTypeSalesComparison: { Version: 1, SourceWorld: 1, PriceTypeId: PRICE_TYPE_ID },
    })
    expect(request.sorted.Row.map(item => item.type)).toEqual([12, 5])
    expect(request.sorted.Col).toEqual([])
    expect(request.sorted.Measurements.map(item => item.Type)).toEqual([4, 70, 71])
    expect(request).not.toHaveProperty('valuationClientAgreementId')
  })
})
