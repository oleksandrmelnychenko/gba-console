import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { grossDataset } from '../data/reportDatasets.test-fixtures'
import { currentProvidedDiscountsDataset as dataset, providedDiscountRequest } from '../data/providedDiscounts.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

let allowed = true
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => allowed }) }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: ({ opened }: { opened: boolean }) => opened ? <div role="dialog" aria-label="Файли сформованого звіту" /> : null,
}))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(), previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}
beforeEach(() => {
  vi.clearAllMocks(); allowed = true; localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([grossDataset, dataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/current24.xlsx' }, raw: {} })
  vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: '4'.repeat(32), Name: 'Наш товар' }])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: { DocumentURL: '/files/current24.xlsx' }, raw: {} },
    preview: { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null,
      Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
      RowSchema: [{ Caption: 'Договір' }], ColumnSchema: [{ Caption: 'Сума знижки' }],
      Rows: [{ Ordinal: 0, SourceIndex: 1, Values: [{ Caption: 'Наш договір' }] }],
      Columns: [{ Ordinal: 0, SourceIndex: 2, Values: [{ Caption: 'Сума знижки' }] }],
      Cells: [{ RowSourceIndex: 1, ColumnSourceIndex: 2, Value: { Kind: 'null', Value: null, Provenance: 'producerCell' } }] } })
})
async function currentForm() {
  const view = render(<Providers><ReportsStocksPage consoleScope={false} constructorMode /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
  fireEvent.click(await screen.findByRole('option', { name: dataset.Name }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Основа наданих знижок' }) as HTMLInputElement).value)
    .toBe('Поточні продажі та повернення'))
  return view
}

describe('current24 constructor', () => {
  it('submits a new current Fenix form and passes only native Source identities through its exact picker', async () => {
    const { container } = await currentForm()
    fireEvent.click(screen.getByRole('tab', { name: /Умови відбору/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Додати умову' }))
    const editor = await screen.findByRole('dialog', { name: 'Додати умову відбору' })
    fireEvent.click(within(editor).getByRole('combobox', { name: 'Поле' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Товар 1С' }))
    await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(24, 41,
      { limit: 30, offset: 0, value: '' }, expect.any(AbortSignal), 1, undefined, 0))
    fireEvent.click(within(editor).getByRole('combobox', { name: 'Значення' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Наш товар' }))
    fireEvent.click(within(editor).getByRole('button', { name: 'Зберегти' }))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 24,
      providedDiscounts: { Version: 1, SourceWorld: 1, Basis: 0 },
      selections: [{ SelectedField: { Type: 41 }, Values: [{ Data: { Id: '4'.repeat(32) } }] }] })
  })

  it.each([undefined, 1] as const)('restores saved basis %s without changing it to the new default', async Basis => {
    const Data = providedDiscountRequest(Basis)
    vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 1, Name: 'Старі знижки', Data }])
    const { container } = render(<Providers><ReportsStocksPage consoleScope={false} constructorMode /></Providers>)
    await screen.findByRole('button', { name: 'Продажі за днями' })
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(await screen.findByRole('button', { name: /Старі знижки/ }))
    expect((screen.getByRole('combobox', { name: 'Основа наданих знижок' }) as HTMLInputElement).value).toBe('Збережений знімок 1С')
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].providedDiscounts).toEqual(Data.providedDiscounts)
    expect(vi.mocked(createStockReport).mock.calls[0][0].sorted.Measurements.map(item => item.Type)).toEqual([65, 66])
  })

  it('shares preview and files with basis0 and removes old results when basis changes', async () => {
    const { container } = await currentForm()
    fireEvent.click(screen.getByRole('button', { name: 'Показати на екрані' }))
    expect(await screen.findByRole('cell', { name: '∅' })).toBeTruthy()
    expect(screen.queryByRole('cell', { name: '0' })).toBeNull()
    fireEvent.submit(container.querySelector('form')!)
    await screen.findByRole('dialog', { name: 'Файли сформованого звіту' })
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual(vi.mocked(previewStockReport).mock.calls[0][0])
    fireEvent.click(screen.getByRole('tab', { name: 'Структура звіту' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Основа наданих знижок' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Збережений знімок 1С' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Результат' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Таблиця попереднього перегляду' })).toBeNull()
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    expect(vi.mocked(createStockReport).mock.calls[1][0].providedDiscounts).toMatchObject({ Basis: 1 })
  })

  it('does not reopen a stale pending export after role loss and a basis change', async () => {
    let complete!: (value: Awaited<ReturnType<typeof createStockReport>>) => void
    vi.mocked(createStockReport).mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
    const { container, rerender } = await currentForm()
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('tab', { name: 'Структура звіту' }))
    allowed = false; rerender(<Providers><ReportsStocksPage consoleScope={false} constructorMode /></Providers>)
    allowed = true; rerender(<Providers><ReportsStocksPage consoleScope={false} constructorMode /></Providers>)
    fireEvent.click(screen.getByRole('combobox', { name: 'Основа наданих знижок' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Збережений знімок 1С' }))
    await act(async () => complete({ document: { DocumentURL: '/files/stale24.xlsx' }, raw: {} }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.submit(container.querySelector('form')!)
    await screen.findByRole('dialog', { name: 'Файли сформованого звіту' })
    expect(vi.mocked(createStockReport).mock.calls[1][0].providedDiscounts).toMatchObject({ Basis: 1 })
  })
})
