import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchValuationAgreements } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets, valuationDataset } from '../data/reportDatasets.test-fixtures'
import type { ReportResult } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

let allowed = true
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => allowed }) }))
vi.mock('./ReportCatalogueControl', () => ({ ReportCatalogueControl: () => null }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened, document }: { opened: boolean; document?: { DocumentURL?: string } }) =>
    opened ? <div role="dialog" aria-label="Файли сформованого звіту">{document?.DocumentURL}</div> : null,
}))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(), searchValuationAgreements: vi.fn(),
}))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(),
}))

function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}
async function ready() {
  const view = render(<Providers><ReportsStocksPage /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  return view
}
async function agreement(id: number) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Договір для оцінки' }))
  fireEvent.click(await screen.findByRole('option', { name: `Договір ${id}` }))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false))
}
const file: ReportResult = { document: { DocumentURL: '/files/exact-contract.xlsx' }, raw: {} }

describe('constructor result and export request identity', () => {
  beforeEach(() => {
    allowed = true
    vi.clearAllMocks()
    localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, valuationDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue(file)
    vi.mocked(searchValuationAgreements).mockResolvedValue([{ Id: 42, Name: 'Договір 42' }, { Id: 43, Name: 'Договір 43' }])
  })

  it('removes the previous valuation file when the selected contract changes', async () => {
    const { container } = await ready()
    fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
    fireEvent.click(await screen.findByRole('option', { name: valuationDataset.Name }))
    await agreement(42)
    fireEvent.submit(container.querySelector('form')!)
    await screen.findByRole('dialog', { name: 'Файли сформованого звіту' })
    expect(vi.mocked(createStockReport).mock.calls[0][0].valuationClientAgreementId).toBe(42)
    await agreement(43)
    expect(screen.queryByRole('dialog', { name: 'Файли сформованого звіту' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Результат' })).toBeNull()
    fireEvent.submit(container.querySelector('form')!)
    await screen.findByRole('dialog', { name: 'Файли сформованого звіту' })
    expect(vi.mocked(createStockReport).mock.calls[1][0].valuationClientAgreementId).toBe(43)
  })

  it('removes exported files after changing the submitted period', async () => {
    const { container } = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Продажі за днями' }))
    fireEvent.submit(container.querySelector('form')!)
    await screen.findByRole('dialog', { name: 'Файли сформованого звіту' })
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-06-01' } })
    expect(screen.queryByRole('dialog', { name: 'Файли сформованого звіту' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Результат' })).toBeNull()
  })

  it('ignores a response completed after constructor permission was revoked', async () => {
    let complete!: (value: ReportResult) => void
    vi.mocked(createStockReport).mockReturnValue(new Promise(resolve => { complete = resolve }))
    const { container, rerender } = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Продажі за днями' }))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    allowed = false
    rerender(<Providers><ReportsStocksPage /></Providers>)
    await act(async () => complete(file))
    expect(screen.queryByRole('dialog', { name: 'Файли сформованого звіту' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Результат' })).toBeNull()
    allowed = true
    rerender(<Providers><ReportsStocksPage /></Providers>)
    expect(screen.queryByRole('dialog', { name: 'Файли сформованого звіту' })).toBeNull()
  })
})
