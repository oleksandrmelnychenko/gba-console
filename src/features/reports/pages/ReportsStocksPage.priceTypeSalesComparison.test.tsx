import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, getCurrentPriceTypeSalesScopeChoices, getOneCTurnoverScopes, previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { grossDataset } from '../data/reportDatasets.test-fixtures'
import {
  PRICE_TYPE_ID,
  PRICE_TYPE_SCOPE,
  priceTypeSalesComparisonDataset,
  priceTypeSalesComparisonRequest,
} from '../data/priceTypeSalesComparison.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

let allowed = true
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => allowed }) }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened }: { opened: boolean }) => opened ? <div role="dialog" aria-label="Файли сформованого звіту" /> : null,
}))
vi.mock('../api/reportsApi', async original => ({
  ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(),
  previewStockReport: vi.fn(),
  getCurrentPriceTypeSalesScopeChoices: vi.fn(),
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
    allowed = true
    localStorage.clear()
    vi.mocked(getReportDatasets).mockResolvedValue([grossDataset, priceTypeSalesComparisonDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(getCurrentPriceTypeSalesScopeChoices).mockResolvedValue({
      Organizations: [{ Id: PRICE_TYPE_SCOPE.OrganizationIds[0], Name: 'Організація Fenix' }],
      ProductKinds: [{ Id: PRICE_TYPE_SCOPE.ProductKindId, Name: 'Товар' }], BuyerRootId: PRICE_TYPE_SCOPE.BuyerRootId,
    })
    vi.mocked(getOneCTurnoverScopes).mockResolvedValue([{
      Key: 'A'.repeat(64), Filters: structuredClone(PRICE_TYPE_SCOPE), OrganizationNames: ['Організація Fenix'],
      FirstDay: '2026-01-01', LastDay: '2026-12-31', LoadedDayCount: 365,
      OldestReadCompletedUtc: '2026-01-01T00:00:00Z', NewestReadCompletedUtc: '2026-12-31T00:00:00Z',
    }])
    vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: PRICE_TYPE_ID, Name: 'Оптова глобальна' }])
    vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/ordinary-d27.xlsx' }, raw: {} })
    vi.mocked(previewStockReport).mockResolvedValue({
      result: { document: { DocumentURL: '/files/ordinary-d27.xlsx' }, raw: {} },
      preview: { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null,
        Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
        RowSchema: [{ Caption: 'Товар' }], ColumnSchema: [{ Caption: 'Сума за типом цін, EUR' }],
        Rows: [{ Ordinal: 0, SourceIndex: 1, Values: [{ Caption: 'Наш товар' }] }],
        Columns: [{ Ordinal: 0, SourceIndex: 2, Values: [{ Caption: 'Сума за типом цін, EUR' }] }],
        Cells: [{ RowSourceIndex: 1, ColumnSourceIndex: 2, Value: { Kind: 'null', Value: null, Provenance: 'producerCell' } }],
      },
    })
  })

  it('submits Fenix Version1 settings, explicit scope and Client → Product defaults', async () => {
    const { container } = render(<Providers><ReportsStocksPage constructorMode /></Providers>)
    await screen.findByRole('button', { name: 'Продажі за днями' })
    fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
    fireEvent.click(await screen.findByRole('option', { name: priceTypeSalesComparisonDataset.Name }))

    expect(screen.getByText(/не формує договірних рекомендацій/)).toBeTruthy()
    await chooseCurrentScope()
    fireEvent.click(screen.getByRole('combobox', { name: 'Глобальний тип ціни Fenix' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Оптова глобальна' }))

    await waitFor(() => expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    const request = vi.mocked(createStockReport).mock.calls[0][0]
    expect(request).toMatchObject({
      dataSource: 27,
      oneC: PRICE_TYPE_SCOPE,
      priceTypeSalesComparison: { Version: 1, SourceWorld: 1, PriceTypeId: PRICE_TYPE_ID, SalesBasis: 0 },
    })
    expect(request.sorted.Row.map(item => item.type)).toEqual([12, 5])
    expect(request.sorted.Col).toEqual([])
    expect(request.sorted.Measurements.map(item => item.Type)).toEqual([4, 70, 71])
    expect(request).not.toHaveProperty('valuationClientAgreementId')
    expect(getOneCTurnoverScopes).not.toHaveBeenCalled()
  })

  it('restores an omitted saved basis without upgrading it to the fresh default', async () => {
    const Data = priceTypeSalesComparisonRequest()
    vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 1, Name: 'Старе порівняння', Data }])
    const { container } = render(<Providers><ReportsStocksPage constructorMode /></Providers>)
    await screen.findByRole('button', { name: 'Продажі за днями' })
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(await screen.findByRole('button', { name: /Старе порівняння/ }))
    expect((screen.getByRole('combobox', { name: 'Основа продажів' }) as HTMLInputElement).value).toBe('Збережені рухи 1С')
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].priceTypeSalesComparison)
      .toEqual({ Version: 1, SourceWorld: 1, PriceTypeId: PRICE_TYPE_ID })
    expect(getCurrentPriceTypeSalesScopeChoices).not.toHaveBeenCalled()
  })

  it('binds preview and export to the same basis0 request, displays missing price as null, and clears both after basis change', async () => {
    const { container } = await currentForm()
    fireEvent.click(screen.getByRole('button', { name: 'Показати на екрані' }))
    expect(await screen.findByRole('cell', { name: '∅' })).toBeTruthy()
    expect(screen.queryByRole('cell', { name: '0' })).toBeNull()
    fireEvent.submit(container.querySelector('form')!)
    await screen.findByRole('dialog', { name: 'Файли сформованого звіту' })
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual(vi.mocked(previewStockReport).mock.calls[0][0])
    expect(vi.mocked(createStockReport).mock.calls[0][0].priceTypeSalesComparison)
      .toMatchObject({ SalesBasis: 0 })
    fireEvent.click(screen.getByRole('tab', { name: 'Структура звіту' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Основа продажів' }))
    fireEvent.click(screen.getByRole('option', { name: 'Збережені рухи 1С' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Результат' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Таблиця попереднього перегляду' })).toBeNull()
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    expect(vi.mocked(createStockReport).mock.calls[1][0].priceTypeSalesComparison).toMatchObject({ SalesBasis: 1 })
  })

  it('discards a pending export after role loss and basis change, even when permission returns before the response', async () => {
    let complete!: (value: Awaited<ReturnType<typeof createStockReport>>) => void
    vi.mocked(createStockReport).mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
    const { container, rerender } = await currentForm()
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('tab', { name: 'Структура звіту' }))
    expect((screen.getByRole('combobox', { name: 'Основа продажів' }) as HTMLInputElement).disabled).toBe(true)
    allowed = false
    rerender(<Providers><ReportsStocksPage constructorMode /></Providers>)
    allowed = true
    rerender(<Providers><ReportsStocksPage constructorMode /></Providers>)
    fireEvent.click(screen.getByRole('combobox', { name: 'Основа продажів' }))
    fireEvent.click(screen.getByRole('option', { name: 'Збережені рухи 1С' }))
    await act(async () => complete({ document: { DocumentURL: '/files/stale-d27.xlsx' }, raw: {} }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.submit(container.querySelector('form')!)
    await screen.findByRole('dialog', { name: 'Файли сформованого звіту' })
    expect(vi.mocked(createStockReport).mock.calls[1][0].priceTypeSalesComparison).toMatchObject({ SalesBasis: 1 })
  })


  it('uses native exact product search only with the advertised current route and preserves its Source ID in the report', async () => {
    const { container } = await currentForm()
    vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: '4'.repeat(32), Name: 'Наш поточний товар' }])
    fireEvent.click(screen.getByRole('tab', { name: /Умови відбору/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Додати умову' }))
    const editor = await screen.findByRole('dialog', { name: 'Додати умову відбору' })
    fireEvent.click(within(editor).getByRole('combobox', { name: 'Поле' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Товар Fenix' }))
    await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(27, 51,
      { limit: 30, offset: 0, value: '' }, expect.any(AbortSignal), undefined, 0))
    fireEvent.click(within(editor).getByRole('combobox', { name: 'Значення' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Наш поточний товар' }))
    fireEvent.click(within(editor).getByRole('button', { name: 'Зберегти' }))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].selections[0]).toMatchObject({
      SelectedField: { Type: 51 }, Values: [{ Data: { Id: '4'.repeat(32) } }],
    })
  })

})


async function chooseCurrentScope() {
  fireEvent.click(screen.getByRole('combobox', { name: 'Організації поточних продажів' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Організація Fenix' }))
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Організації поточних продажів' }), { key: 'Escape' })
  fireEvent.click(screen.getByRole('combobox', { name: 'Вид товару поточних продажів' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Товар' }))
}

async function currentForm() {
  const view = render(<Providers><ReportsStocksPage constructorMode /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
  fireEvent.click(await screen.findByRole('option', { name: priceTypeSalesComparisonDataset.Name }))
  await chooseCurrentScope()
  fireEvent.click(screen.getByRole('combobox', { name: 'Глобальний тип ціни Fenix' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Оптова глобальна' }))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false))
  return view
}
