import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { comparisonDataset } from '../data/agreementPriceComparison.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { NetUid: 'comparison-owner' }, hasPermission: () => true }) }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(),
}))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(), searchDatasetReportValues: vi.fn(),
}))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: () => null,
}))

function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, comparisonDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockImplementation(async (_source, field) => field === 9
    ? [{ Id: 41, Name: 'Договір A [41]' }, { Id: 42, Name: 'Договір B [42]' }]
    : [{ Id: 7, Name: 'Товар [7]' }])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/comparison.xlsx' }, raw: {} })
})

it('forms a report only after selecting two distinct local agreements and a product', async () => {
  const view = render(<Providers><ReportsStocksPage /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
  fireEvent.click(await screen.findByRole('option', { name: comparisonDataset.Name }))
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)

  fireEvent.click(screen.getByRole('combobox', { name: 'Базовий договір клієнта' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Договір A [41]' }))
  fireEvent.click(screen.getByRole('combobox', { name: 'Договір для порівняння' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Договір B [42]' }))
  fireEvent.click(screen.getByRole('combobox', { name: /Товари/ }))
  fireEvent.change(screen.getByRole('combobox', { name: /Товари/ }), { target: { value: 'Товар' } })
  await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(31, 1, expect.objectContaining({ value: 'Товар', limit: 25 }), expect.any(AbortSignal)))
  fireEvent.click(await screen.findByRole('option', { name: 'Товар [7]' }))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 31, from: '', to: '',
    agreementPriceComparison: { version: 1, baseClientAgreementId: 41, comparedClientAgreementId: 42, productIds: [7] },
    sorted: { Row: [{ type: 5 }, { type: 28 }], Col: [], Measurements: [{ Type: 75 }, { Type: 76 }, { Type: 77 }, { Type: 78 }] } })
  expect(searchDatasetReportValues).toHaveBeenCalledWith(31, 9, expect.objectContaining({ limit: 25 }), expect.any(AbortSignal))
  expect(within(view.container).getByText(/Порівняння з нашої SQL бази/)).toBeTruthy()
})
