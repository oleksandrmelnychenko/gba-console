import { unconfirmedBatch } from '../../../shared/ui/product-movement-history/physicalQuantityExceptions.test-fixtures'
import { MantineProvider } from '@mantine/core'
// @ts-expect-error Keep the Node type scope out of the application compilation unit.
import { readFileSync } from 'node:fs'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { partialPhysicalCoverage } from '../../../shared/ui/product-movement-history/physicalCoverage.test-fixtures'
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
  it.each([false, true])('shows physical coverage outside collapsed notes, empty=%s', async empty => {
    vi.mocked(previewStockMovement).mockImplementation(async request => ({
      ...stockMovementResult(request, empty ? [] : stockMovementRows),
      PhysicalCoverage: [partialPhysicalCoverage],
    }))
    render(panel())
    await applyReport()
    const warning = screen.getByText('Імпортована історія не покриває весь вибраний період')
    expect(warning.closest('[role="alert"]')?.textContent).toContain('01.01.2025 — 02.11.2026')
    expect(warning.closest('details')).toBeNull()
    expect(document.body.textContent).not.toMatch(/private-publication|private-receipt/)
    if (!empty) expect(screen.getByText('СКЛАД -1')).toBeTruthy()
  })

  it('applies all GBA history and renders the 1C layout with totals and red negatives', async () => {
    const busy = vi.fn()
    render(panel(true, busy))
    expect(screen.queryByText(/синхронізовано/)).toBeNull()
    const filters = await screen.findByRole('group', { name: 'Відбори' })
    for (const label of ['Склад у списку', 'Організація складу', 'Номенклатура у списку', 'Група товарів (з підгрупами)', 'Вид документа руху', 'Документ руху містить']) {
      expect(within(filters).getByLabelText(label)).toBeTruthy()
    }
    expect(within(filters).getByRole('group', { name: 'Фільтр артикула' })).toBeTruthy()
    for (const name of ['Склади', 'Номенклатура', 'Фільтри']) {
      expect(screen.queryByRole('group', { name })).toBeNull()
    }
    expect(previewStockMovement).not.toHaveBeenCalled()
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

  it('searches products remotely after the shared delay and sends the chosen ids', async () => {
    render(panel())
    const products = await screen.findByRole('combobox', { name: 'Номенклатура у списку' })
    fireEvent.focus(products)
    expect((await screen.findAllByText('Почніть вводити назву')).length).toBeGreaterThan(0)
    fireEvent.change(products, { target: { value: '94' } })
    fireEvent.change(products, { target: { value: '940' } })
    expect(searchStockMovementProducts).not.toHaveBeenCalled()
    await waitFor(() => expect(searchStockMovementProducts).toHaveBeenCalledOnce())
    expect(vi.mocked(searchStockMovementProducts).mock.calls[0][0]).toBe('940')
    fireEvent.click(await screen.findByRole('option', { name: '94000 — Фільтр масляний' }))
    expect(screen.getByRole('button', { name: 'Видалити 94000 — Фільтр масляний' })).toBeTruthy()
    await applyReport()
    expect(previews()[0]).toMatchObject({ ProductIds: [38221591] })
    expect(searchStockMovementGroups).not.toHaveBeenCalled()
  })

  it('sends the chosen warehouses, organizations, document kinds and groups', async () => {
    render(panel())
    fireEvent.change(await screen.findByRole('combobox', { name: 'Група товарів (з підгрупами)' }), { target: { value: 'Філ' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Фільтри' }))
    for (const [label, option] of [['Склад у списку', 'СКЛАД -1 · Фенікс'], ['Склад у списку', 'СКЛАД Н/П · Фенікс'],
      ['Організація складу', 'Фенікс'], ['Вид документа руху', 'Переміщення'], ['Вид документа руху', 'Продаж']]) {
      fireEvent.click(screen.getByRole('combobox', { name: label }))
      fireEvent.click(await screen.findByRole('option', { name: option }))
    }
    await applyReport()
    expect(JSON.stringify(previews()[0])).toMatchInlineSnapshot(`"{"Version":1,"From":"2025-01-01","To":"2026-10-26","WarehouseIds":[2968,2975],"OrganizationIds":[1],"ProductIds":[],"ArticleMatch":"","Articles":[],"ProductGroupIds":[7],"DocumentKinds":["sale","transfer"],"DocumentText":null,"Conditions":[],"Levels":["warehouse","product","registrar"],"Measures":["opening","incoming","outgoing","closing"],"GrandTotals":true,"NegativeRed":true,"Offset":0,"Limit":200}"`)
  })

  it('shows a failed product lookup with a retry instead of an empty list', async () => {
    vi.mocked(searchStockMovementProducts).mockRejectedValueOnce(new Error('offline'))
    render(panel())
    const products = await screen.findByRole('combobox', { name: 'Номенклатура у списку' })
    fireEvent.focus(products)
    fireEvent.change(products, { target: { value: '940' } })
    expect((await screen.findByRole('alert')).textContent).toBe('Не вдалося завантажити значення.')
    expect(screen.queryByText('Нічого не знайдено')).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: 'Спробувати ще раз' }))
    expect(await screen.findByRole('option', { name: '94000 — Фільтр масляний' })).toBeTruthy()
    expect(vi.mocked(searchStockMovementProducts).mock.calls.map(call => call[0])).toEqual(['940', '940'])
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


it.each([false, true])('keeps unknown warehouse totals and explicit exception through export, empty=%s', async empty => {
  vi.mocked(previewStockMovement).mockImplementation(async request => ({
    ...stockMovementResult(request, empty ? [] : stockMovementRows.map(row => ({ ...row, Quantity: { Opening: null, Incoming: 0, Outgoing: null, Closing: null } }))),
    Totals: { Opening: null, Incoming: 0, Outgoing: null, Closing: null }, PhysicalQuantityExceptions: [unconfirmedBatch],
  }))
  render(panel())
  const table = await applyReport()
  expect(screen.getByRole('alert').textContent).toContain('ВО-00041')
  const footer = table.querySelector('tfoot')!
  expect(footer.textContent).toBe('Підсумок———')
  expect(footer.querySelector('[data-negative="true"]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Excel' }))
  await waitFor(() => expect(exportStockMovement).toHaveBeenCalledOnce())
  expect(vi.mocked(exportStockMovement).mock.calls[0][0]).toEqual({ ...previews()[0], Offset: 0, Limit: 1 })
  expect(footer.textContent).toBe('Підсумок———')
})

it('keeps the result heading at the section-title size of the other reports', async () => {
  const styles = readFileSync('src/features/reports/pages/workbook-desk/workbook-desk.css', 'utf8')
  expect(styles).toContain('.published-movement .workbook-result > .app-section-title { margin: 0; font-size: 14px; }')
  render(panel()); await applyReport()
  const heading = screen.getByRole('heading', { name: 'Результат' })
  expect(heading.className).toBe('app-section-title')
  expect(heading.parentElement?.className).toBe('workbook-result')
  expect(heading.closest('.published-movement')).not.toBeNull()
})
