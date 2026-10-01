import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, previewStockReport, searchValuationAgreements } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets, valuationDataset } from '../data/reportDatasets.test-fixtures'
import type { ReportDataset, ReportResult } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

let allowed = true
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => allowed }) }))
vi.mock('./ReportCatalogueControl', () => ({ ReportCatalogueControl: () => null }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened, document }: { opened: boolean; document?: { DocumentURL?: string } }) =>
    opened ? <div role="dialog" aria-label="Файли сформованого звіту">{document?.DocumentURL}</div> : null,
}))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(), previewStockReport: vi.fn(), searchValuationAgreements: vi.fn(),
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
const supplierDataset: ReportDataset = {
  DataSource: 38, Name: 'Прибуток за постачальниками', Description: 'Продажі та повернення',
  PeriodRequired: true, PeriodSupported: true,
  supplierBasis: { Version: 1, DefaultBasis: 0, Bases: [0, 1], MaximumDays: 31,
    IncludesReturns: true, PreservesUnavailableValues: true, RegistrarWarehouseGrouping: 78 },
  supplierSourceWorld: { Version: 1, SourceWorlds: [0, 1], RequiresCompletePeriodLineage: true },
  Groupings: [73, 78, 4, 21].map(Type => ({ Type, Name: `Група ${Type}` })),
  Measurements: [0, 2, 3, 4, 6, 7, 8, 10, 12, 14].map(Type => ({ Type, Name: `Показник ${Type}` })),
  Filters: [0, 1, 17].map(Type => ({ Type, Name: `Фільтр ${Type}` })), Limitations: [],
}

describe('constructor result and export request identity', () => {
  beforeEach(() => {
    allowed = true
    vi.clearAllMocks()
    localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, valuationDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue(file)
    vi.mocked(previewStockReport).mockResolvedValue({ result: file, preview: {
      Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
      Request: null,
      Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
      RowSchema: [{ Caption: 'Клієнт' }], ColumnSchema: [{ Caption: 'Сума' }],
      Rows: [{ Ordinal: 0, SourceIndex: 1, Values: [{ Caption: 'Покупець А' }] }],
      Columns: [{ Ordinal: 0, SourceIndex: 2, Values: [{ Caption: 'Продажі' }] }],
      Cells: [{ RowSourceIndex: 1, ColumnSourceIndex: 2, Value: { Kind: 'decimal', Value: '12.50', Provenance: 'producerCell' } }],
    } })
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

  it('shows a bounded typed result without opening files or running a second calculation', async () => {
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Продажі за днями' }))
    fireEvent.click(screen.getByRole('button', { name: 'Показати на екрані' }))
    expect(await screen.findByRole('cell', { name: '12.50' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Таблиця попереднього перегляду' })).toBeTruthy()
    expect(vi.mocked(previewStockReport)).toHaveBeenCalledOnce()
    expect(vi.mocked(createStockReport)).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Файли сформованого звіту' })).toBeNull()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-06-01' } })
    expect(screen.queryByRole('region', { name: 'Таблиця попереднього перегляду' })).toBeNull()
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

  it('binds supplier preview and export to the same ordinary request and preserves null financial values', async () => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, supplierDataset])
    const response = await vi.mocked(previewStockReport).getMockImplementation()!({} as never)
    response.preview.RowSchema = [{ Caption: 'Склад документа' }, { Caption: 'Постачальник' }]
    response.preview.Rows[0].Values = [{ Caption: 'Склад не визначено' },
      { Caption: 'Постачальника повернення не визначено' }]
    response.preview.Cells[0].Value = { Kind: 'null', Value: null, Provenance: 'producerCell' }
    vi.mocked(previewStockReport).mockResolvedValue(response)
    const { container } = await ready()
    fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
    fireEvent.click(await screen.findByRole('option', { name: supplierDataset.Name }))
    fireEvent.click(screen.getByRole('button', { name: 'Показати на екрані' }))
    expect(await screen.findByRole('cell', { name: '∅' })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'Склад не визначено' })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'Постачальника повернення не визначено' })).toBeTruthy()
    expect(screen.queryByRole('cell', { name: '0' })).toBeNull()
    fireEvent.submit(container.querySelector('form')!)
    await screen.findByRole('dialog', { name: 'Файли сформованого звіту' })
    const exported = vi.mocked(createStockReport).mock.calls[0][0]
    expect(exported).toEqual(vi.mocked(previewStockReport).mock.calls[0][0])
    expect(exported.supplierBasis).toBe(0)
    expect(exported.sorted.Row.map(field => field.type)).toEqual([78, 4, 21])
    fireEvent.click(screen.getByRole('combobox', { name: 'Розрахунок за постачальниками' }))
    fireEvent.click(screen.getByRole('option', { name: 'Продажі за партіями без повернень' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Таблиця попереднього перегляду' })).toBeNull()
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    expect(vi.mocked(createStockReport).mock.calls[1][0].supplierBasis).toBe(1)
  })

  it('rejects a supplier export after role loss and an explicit basis change even if permission returns first', async () => {
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, supplierDataset])
    let complete!: (value: ReportResult) => void
    vi.mocked(createStockReport).mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
    const { container, rerender } = await ready()
    fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
    fireEvent.click(await screen.findByRole('option', { name: supplierDataset.Name }))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect((screen.getByRole('combobox', { name: 'Розрахунок за постачальниками' }) as HTMLInputElement).disabled).toBe(true)
    allowed = false
    rerender(<Providers><ReportsStocksPage /></Providers>)
    allowed = true
    rerender(<Providers><ReportsStocksPage /></Providers>)
    fireEvent.click(screen.getByRole('combobox', { name: 'Розрахунок за постачальниками' }))
    fireEvent.click(screen.getByRole('option', { name: 'Продажі за партіями без повернень' }))
    await act(async () => complete(file))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Результат' })).toBeNull()
    fireEvent.submit(container.querySelector('form')!)
    await screen.findByRole('dialog')
    expect(vi.mocked(createStockReport).mock.calls[1][0].supplierBasis).toBe(1)
  })
})
