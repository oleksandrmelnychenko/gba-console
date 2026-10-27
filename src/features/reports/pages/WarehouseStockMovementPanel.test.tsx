import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  exportStockMovement, getStockMovementCapability, getStockMovementOrganizations, getStockMovementWarehouses, previewStockMovement,
  searchStockMovementGroups, searchStockMovementProducts,
} from '../api/warehouseStockMovementApi'
import type { StockMovementRequest } from '../data/warehouseStockMovement'
import {
  stockMovementCapability, stockMovementExport, stockMovementGroups, stockMovementOrganizations, stockMovementProducts, stockMovementResult,
  stockMovementRows, stockMovementWarehouses,
} from '../testing/warehouseStockMovementFixtures'
import { WarehouseStockMovementPanel } from './WarehouseStockMovementPanel'

vi.mock('../api/warehouseStockMovementApi', () => ({
  getStockMovementCapability: vi.fn(), getStockMovementWarehouses: vi.fn(), getStockMovementOrganizations: vi.fn(),
  searchStockMovementProducts: vi.fn(), searchStockMovementGroups: vi.fn(), previewStockMovement: vi.fn(), exportStockMovement: vi.fn(),
}))

const panel = (allowed = true, onBusyChange?: (busy: boolean) => void) => <MantineProvider env="test"><I18nProvider>
  <WarehouseStockMovementPanel callerKey={allowed ? 'owner' : null} canGenerate={allowed} onBusyChange={onBusyChange} />
</I18nProvider></MantineProvider>
const openSearch = () => screen.getAllByPlaceholderText('Пошук').filter(input => !input.closest('[style*="display: none"]'))[0]
const previews = () => vi.mocked(previewStockMovement).mock.calls.map(call => call[0])

async function applyReport() {
  fireEvent.click(await screen.findByRole('button', { name: 'Застосувати й показати' }))
  return screen.findByRole('table', { name: 'Рух товару — залишки, прихід і розхід' })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getStockMovementCapability).mockResolvedValue(structuredClone(stockMovementCapability))
  vi.mocked(getStockMovementWarehouses).mockResolvedValue(structuredClone(stockMovementWarehouses))
  vi.mocked(getStockMovementOrganizations).mockResolvedValue(structuredClone(stockMovementOrganizations))
  vi.mocked(searchStockMovementProducts).mockResolvedValue(structuredClone(stockMovementProducts))
  vi.mocked(searchStockMovementGroups).mockResolvedValue(structuredClone(stockMovementGroups))
  vi.mocked(previewStockMovement).mockImplementation(async (request: StockMovementRequest) => stockMovementResult(request))
  vi.mocked(exportStockMovement).mockResolvedValue(stockMovementExport)
})

describe('native warehouse stock movement', () => {
  it('applies all GBA history and renders the 1C layout with totals and red negatives', async () => {
    const busy = vi.fn()
    render(panel(true, busy))
    expect(screen.queryByText(/синхронізовано/)).toBeNull()
    const table = await applyReport()
    expect(previews()[0]).toMatchObject({ From: '2025-01-01', To: '2026-10-26', Levels: ['warehouse', 'product', 'registrar'], Offset: 0, Limit: 200 })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(1 + stockMovementRows.length + 1)
    expect(rows[1].textContent).toContain('СКЛАД -1')
    expect(rows[1].getAttribute('data-summary')).toBe('true')
    const opening = within(rows[1]).getAllByRole('cell')[1]
    expect(opening.textContent).toBe('-2')
    expect(opening.getAttribute('data-negative')).toBe('true')
    expect(rows[3].textContent).toContain('Прихідна накладна ПН-1 від 03.02.2025 10:00:00')
    expect(within(rows[3]).getAllByRole('cell')[3].textContent).toBe('')
    expect(rows[4].textContent).toContain('· GBA')
    expect(within(rows[5]).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Підсумок', '-2', '10', '3', '5'])
    expect(screen.getByText('1–4 із 4')).toBeTruthy()
    expect(busy).toHaveBeenCalledWith(true)
    await waitFor(() => expect(busy).toHaveBeenLastCalledWith(false))
  })

  it('filters by article as you type once a table exists, after the 400 ms debounce', async () => {
    render(panel())
    await applyReport()
    fireEvent.change(screen.getByLabelText('Значення артикула'), { target: { value: '9400' } })
    fireEvent.change(screen.getByLabelText('Значення артикула'), { target: { value: '94000' } })
    expect(previewStockMovement).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(previewStockMovement).toHaveBeenCalledTimes(2))
    expect(previews()[1]).toMatchObject({ ArticleMatch: 'equals', Articles: ['94000'], Offset: 0 })
    fireEvent.change(screen.getByLabelText('Документ руху містить'), { target: { value: 'ВН-7' } })
    await waitFor(() => expect(previewStockMovement).toHaveBeenCalledTimes(3))
    expect(previews()[2]).toMatchObject({ Articles: ['94000'], DocumentText: 'ВН-7' })
  })

  it('does not query before the first apply and does not repeat an unchanged search', async () => {
    render(panel())
    fireEvent.change(await screen.findByLabelText('Значення артикула'), { target: { value: '94000' } })
    await new Promise(resolve => setTimeout(resolve, 500))
    expect(previewStockMovement).not.toHaveBeenCalled()
    await applyReport()
    expect(previews()[0]).toMatchObject({ Articles: ['94000'] })
    await new Promise(resolve => setTimeout(resolve, 500))
    expect(previewStockMovement).toHaveBeenCalledTimes(1)
  })

  it('pages the applied request even when the draft has pending changes', async () => {
    const many = Array.from({ length: 450 }, (_, index) => ({ ...stockMovementRows[2], Index: index, Label: `Документ ${index}` }))
    vi.mocked(previewStockMovement).mockImplementation(async (request: StockMovementRequest) => stockMovementResult(request, many))
    render(panel())
    await applyReport()
    expect(screen.getByText('1–200 із 450')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Виводити загальні підсумки'))
    expect(screen.getByText(/Налаштування змінено/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Наступні рядки' }))
    await screen.findByText('201–400 із 450')
    expect(previews()[1]).toEqual({ ...previews()[0], Offset: 200 })
    expect(screen.getByText('Документ 200')).toBeTruthy()
  })

  it('exports the applied report to Excel and offers the signed file', async () => {
    render(panel())
    expect((await screen.findByRole('button', { name: 'Excel' }) as HTMLButtonElement).disabled).toBe(true)
    await applyReport()
    fireEvent.click(screen.getByRole('button', { name: 'Excel' }))
    await waitFor(() => expect(exportStockMovement).toHaveBeenCalledOnce())
    expect(vi.mocked(exportStockMovement).mock.calls[0][0]).toEqual({ ...previews()[0], Offset: 0, Limit: 1 })
    const dialog = await screen.findByRole('dialog')
    expect(dialog.innerHTML).toContain('/files/rukh.xlsx?sig=1')
  })

  it('searches products remotely after 400 ms and sends the chosen ids', async () => {
    render(panel())
    fireEvent.click(await screen.findByLabelText('Номенклатура у списку'))
    fireEvent.change(openSearch(), { target: { value: '94' } })
    fireEvent.change(openSearch(), { target: { value: '940' } })
    expect(searchStockMovementProducts).not.toHaveBeenCalled()
    await waitFor(() => expect(searchStockMovementProducts).toHaveBeenCalledOnce())
    expect(vi.mocked(searchStockMovementProducts).mock.calls[0][0]).toBe('940')
    fireEvent.click(await screen.findByText('94000 — Фільтр масляний'))
    await applyReport()
    expect(previews()[0]).toMatchObject({ ProductIds: [38221591] })
    expect(searchStockMovementGroups).not.toHaveBeenCalled()
  })

  it('validates grouping before calling the server', async () => {
    render(panel())
    fireEvent.click(await screen.findByLabelText('Склад'))
    fireEvent.click(screen.getByLabelText('Номенклатура.Артикул'))
    fireEvent.click(screen.getByLabelText('Документ руху (реєстратор)'))
    expect(screen.getByText('Оберіть хоча б одне групування рядків.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Застосувати й показати' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Місяць'))
    fireEvent.click(screen.getByLabelText('Документ руху (реєстратор)'))
    await applyReport()
    expect(previews()[0].Levels).toEqual(['month', 'registrar'])
  })

  it('shows server errors and lets the setup be retried', async () => {
    vi.mocked(getStockMovementCapability).mockRejectedValueOnce(new Error('Сервер недоступний'))
    render(panel())
    expect(await screen.findByText('Сервер недоступний')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Повторити' }))
    expect(await screen.findByRole('button', { name: 'Застосувати й показати' })).toBeTruthy()
    vi.mocked(previewStockMovement).mockRejectedValueOnce(new Error('Звіт тимчасово недоступний'))
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
    expect(await screen.findByText('Звіт тимчасово недоступний')).toBeTruthy()
  })

  it('does not load anything without the report permission', () => {
    render(panel(false))
    expect(screen.getByText('Немає права формування звітів по складу.')).toBeTruthy()
    expect(getStockMovementCapability).not.toHaveBeenCalled()
  })
})
