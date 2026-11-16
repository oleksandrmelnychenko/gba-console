import { unconfirmedBatch } from '../../../shared/ui/product-movement-history/physicalQuantityExceptions.test-fixtures'
import { MantineProvider } from '@mantine/core'
// @ts-expect-error Keep the Node type scope out of the application compilation unit.
import { readFileSync } from 'node:fs'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { partialPhysicalCoverage } from '../../../shared/ui/product-movement-history/physicalCoverage.test-fixtures'
import {
  exportStockMovement, getStockMovementCapability, getStockMovementMeasureUnits, getStockMovementOrganizations, getStockMovementWarehouses, previewStockMovement,
  searchStockMovementGroups, searchStockMovementProducts,
} from '../api/warehouseStockMovementApi'
import { searchCustomerGroupTop } from '../api/customerGroupTopApi'
import type { StockMovementRequest } from '../data/warehouseStockMovement'
import {
  stockMovementCapability, stockMovementExport, stockMovementGroups, stockMovementOrganizations, stockMovementProducts, stockMovementResult,
  stockMovementRows, stockMovementWarehouses,
} from '../testing/warehouseStockMovementFixtures'
import { WarehouseStockMovementPanel } from './WarehouseStockMovementPanel'

vi.mock('../api/warehouseStockMovementApi', () => ({
  getStockMovementCapability: vi.fn(), getStockMovementWarehouses: vi.fn(), getStockMovementOrganizations: vi.fn(), getStockMovementMeasureUnits: vi.fn(),
  searchStockMovementProducts: vi.fn(), searchStockMovementGroups: vi.fn(), previewStockMovement: vi.fn(), exportStockMovement: vi.fn(),
}))

const panel = (allowed = true, onBusyChange?: (busy: boolean) => void) => <MantineProvider env="test"><I18nProvider>
  <WarehouseStockMovementPanel callerKey={allowed ? 'owner' : null} canGenerate={allowed} onBusyChange={onBusyChange} />
</I18nProvider></MantineProvider>
vi.mock('../api/customerGroupTopApi', () => ({ searchCustomerGroupTop: vi.fn() }))

async function addFilter(field: string) {
  const filters = await screen.findByRole('region', { name: 'Відбори' })
  fireEvent.click(within(filters).getByRole('button', { name: 'Додати відбір' }))
  const rows = within(filters).getAllByRole('group', { name: /^Умова відбору \d+$/ })
  const row = rows[rows.length - 1]
  fireEvent.click(within(row).getByRole('combobox', { name: 'Поле' }))
  fireEvent.click(await screen.findByRole('option', { name: field }))
  return row
}

const previews = () => vi.mocked(previewStockMovement).mock.calls.map(call => call[0])

function oldServer(tree = false) {
  const { MaximumFilterRows: _rows, ...old } = structuredClone(stockMovementCapability)
  void _rows
  vi.mocked(getStockMovementCapability).mockResolvedValue(tree ? { ...old, FilterExpression: { Version: 1, MaximumDepth: 8, MaximumLeaves: 9, Operators: [1, 2] } } : old)
}

const treeCapability = () => vi.mocked(getStockMovementCapability).mockResolvedValue({ ...structuredClone(stockMovementCapability),
  FilterExpression: { Version: 1, MaximumDepth: 8, MaximumLeaves: 9, Operators: [1, 2] } })

async function pick(row: HTMLElement, option: string) {
  fireEvent.click(within(row).getByRole('combobox', { name: 'Значення' }))
  const options = await screen.findAllByRole('option', { name: option })
  fireEvent.click(options[options.length - 1])
}

async function applyReport() {
  fireEvent.click(await screen.findByRole('button', { name: 'Застосувати й показати' }))
  return screen.findByRole('table', { name: 'Рух товару — залишки, прихід і розхід' })
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getStockMovementCapability).mockResolvedValue(structuredClone(stockMovementCapability))
  vi.mocked(getStockMovementWarehouses).mockResolvedValue(structuredClone(stockMovementWarehouses))
  vi.mocked(getStockMovementOrganizations).mockResolvedValue(structuredClone(stockMovementOrganizations))
  vi.mocked(getStockMovementMeasureUnits).mockResolvedValue([{ Id: 1, Name: 'шт', Detail: null }, { Id: 2, Name: 'компл', Detail: null }])
  vi.mocked(searchCustomerGroupTop).mockResolvedValue(['A', 'B'])
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

  it('applies the current month and renders the 1C layout with totals and red negatives', async () => {
    const busy = vi.fn()
    render(panel(true, busy))
    expect(screen.queryByText(/синхронізовано/)).toBeNull()
    const filters = await screen.findByRole('group', { name: 'Відбори' })
    expect(within(filters).getByText('Відборів немає. Натисніть «Додати», щоб звузити звіт.')).toBeTruthy()
    for (const action of ['Додати відбір', 'Змінити вибраний відбір', 'Видалити вибраний відбір', 'Копіювати вибраний відбір'])
      expect(within(filters).getByRole('button', { name: action })).toBeTruthy()
    fireEvent.click(within(filters).getByRole('button', { name: 'Додати відбір' }))
    fireEvent.click(within(filters).getByRole('combobox', { name: 'Поле' }))
    const listbox = await screen.findByRole('listbox')
    expect([...listbox.querySelectorAll('[role="option"]')].map(option => option.textContent)).toEqual(
      ['Організація складу', 'Товар', 'Артикул', 'Топ', 'Товарна група', 'Одиниця виміру', 'Склад', 'Вид документа руху', 'Документ руху'])
    expect([...listbox.querySelectorAll('[class*="groupLabel"]')].map(label => label.textContent)).toEqual(['Товар', 'Склад', 'Документ руху'])
    fireEvent.click(within(filters).getByRole('button', { name: 'Видалити умову 1' }))
    for (const name of ['Склади', 'Номенклатура', 'Фільтри']) {
      expect(screen.queryByRole('group', { name })).toBeNull()
    }
    expect(previewStockMovement).not.toHaveBeenCalled()
    const table = await applyReport()
    expect(previews()[0]).toMatchObject({ From: '2026-10-01', To: '2026-10-26', Levels: ['warehouse', 'product', 'registrar'], Offset: 0, Limit: 200 })
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
    expect(screen.queryByText(/у підсумку: кількість/)).toBeNull()
    expect(screen.getByText('1–4 із 4')).toBeTruthy()
    expect(busy).toHaveBeenCalledWith(true)
    await waitFor(() => expect(busy).toHaveBeenLastCalledWith(false))
  })

  it('filters by article as you type once a table exists, after the 400 ms debounce', async () => {
    render(panel())
    await applyReport()
    await addFilter('Артикул')
    fireEvent.change(screen.getByLabelText('Значення артикула'), { target: { value: '9400' } })
    fireEvent.change(screen.getByLabelText('Значення артикула'), { target: { value: '94000' } })
    expect(previewStockMovement).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(previewStockMovement).toHaveBeenCalledTimes(2))
    expect(previews()[1]).toMatchObject({ Filters: [{ Field: 'article', ArticleMatch: 'equals', Values: ['94000'] }], Offset: 0 })
    const document = await addFilter('Документ руху')
    fireEvent.change(within(document).getByRole('textbox', { name: 'Значення' }), { target: { value: 'ВН-7' } })
    await waitFor(() => expect(previewStockMovement).toHaveBeenCalledTimes(3))
    expect(previews()[2]).toMatchObject({ Filters: [{ Field: 'article', Values: ['94000'] }, { Field: 'documentText', Text: 'ВН-7' }] })
  })

  it('does not query before the first apply and does not repeat an unchanged search', async () => {
    render(panel())
    await addFilter('Артикул')
    fireEvent.change(await screen.findByLabelText('Значення артикула'), { target: { value: '94000' } })
    await new Promise(resolve => setTimeout(resolve, 500))
    expect(previewStockMovement).not.toHaveBeenCalled()
    await applyReport()
    expect(previews()[0]).toMatchObject({ Filters: [{ Field: 'article', Values: ['94000'] }] })
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
    const products = within(await addFilter('Товар')).getByRole('combobox', { name: 'Значення' })
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
    expect(previews()[0]).toMatchObject({ ProductIds: [], Filters: [{ Field: 'product', Ids: [38221591] }] })
    expect(searchStockMovementGroups).not.toHaveBeenCalled()
  })

  it('sends the chosen warehouses, organizations, document kinds and groups as separate fields to an older server', async () => {
    oldServer()
    render(panel())
    fireEvent.change(within(await addFilter('Товарна група')).getByRole('combobox', { name: 'Значення' }), { target: { value: 'Філ' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Фільтри' }))
    for (const [field, options] of [['Склад', ['СКЛАД -1 · Фенікс', 'СКЛАД Н/П · Фенікс']], ['Організація складу', ['Фенікс']],
      ['Вид документа руху', ['Переміщення', 'Продаж']], ['Топ', ['B']], ['Одиниця виміру', ['компл']]] as const) {
      const row = await addFilter(field)
      for (const option of options) {
        fireEvent.click(within(row).getByRole('combobox', { name: 'Значення' }))
        fireEvent.click(await screen.findByRole('option', { name: option }))
      }
    }
    await applyReport()
    expect(JSON.stringify(previews()[0])).toMatchInlineSnapshot(`"{"Version":1,"From":"2026-10-01","To":"2026-10-26","WarehouseIds":[2968,2975],"OrganizationIds":[1],"ProductIds":[],"ArticleMatch":"","Articles":[],"ProductGroupIds":[7],"ProductTops":["B"],"MeasureUnitIds":[2],"DocumentKinds":["sale","transfer"],"DocumentText":null,"Conditions":[],"Levels":["warehouse","product","registrar"],"Measures":["opening","incoming","outgoing","closing"],"GrandTotals":true,"NegativeRed":true,"Offset":0,"Limit":200}"`)
  })

  it('sends the chosen rows as the filter list with their own values', async () => {
    render(panel())
    fireEvent.change(within(await addFilter('Товарна група')).getByRole('combobox', { name: 'Значення' }), { target: { value: 'Філ' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Фільтри' }))
    for (const [field, options] of [['Склад', ['СКЛАД -1 · Фенікс', 'СКЛАД Н/П · Фенікс']], ['Організація складу', ['Фенікс']],
      ['Вид документа руху', ['Переміщення', 'Продаж']], ['Топ', ['B']], ['Одиниця виміру', ['компл']]] as const) {
      const row = await addFilter(field)
      for (const option of options) await pick(row, option)
    }
    await applyReport()
    expect(JSON.stringify(previews()[0])).toMatchInlineSnapshot(`"{"Version":1,"From":"2026-10-01","To":"2026-10-26","WarehouseIds":[],"OrganizationIds":[],"ProductIds":[],"ArticleMatch":"","Articles":[],"ProductGroupIds":[],"ProductTops":[],"MeasureUnitIds":[],"Filters":[{"Field":"group","Ids":[7],"Row":1},{"Field":"warehouse","Ids":[2968,2975],"Row":2},{"Field":"organization","Ids":[1],"Row":3},{"Field":"documentKind","Values":["sale","transfer"],"Row":4},{"Field":"top","Values":["B"],"Row":5},{"Field":"unit","Ids":[2],"Row":6}],"DocumentKinds":[],"DocumentText":null,"Conditions":[],"Levels":["warehouse","product","registrar"],"Measures":["opening","incoming","outgoing","closing"],"GrandTotals":true,"NegativeRed":true,"Offset":0,"Limit":200}"`)
  })

  it('builds «група A АБО група B» from two rows of the same field and shows their values in the tree', async () => {
    treeCapability()
    render(panel())
    const first = await addFilter('Склад')
    await pick(first, 'СКЛАД -1 · Фенікс')
    const filters = await screen.findByRole('region', { name: 'Відбори' })
    fireEvent.click(within(filters).getByRole('button', { name: 'Додати відбір' }))
    const second = within(filters).getAllByRole('group', { name: /^Умова відбору \d+$/ })[1]
    fireEvent.click(within(second).getByRole('combobox', { name: 'Поле' }))
    expect((await screen.findByRole('option', { name: 'Склад' })).getAttribute('data-combobox-disabled')).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: 'Склад' }))
    await pick(second, 'СКЛАД Н/П · Фенікс')
    fireEvent.click(screen.getByRole('button', { name: 'Налаштувати групи І/АБО' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Оператор — Коренева група' }))
    fireEvent.click(await screen.findByRole('option', { name: 'АБО — будь-яка умова' }))
    const logic = screen.getByRole('region', { name: 'Логіка умов відбору' })
    expect(logic.textContent).toContain('№1: Склад В списку СКЛАД -1')
    expect(logic.textContent).toContain('№2: Склад В списку СКЛАД Н/П')
    expect(logic.textContent).not.toContain('· Фенікс')
    await applyReport()
    expect(previews()[0]).toMatchObject({ WarehouseIds: [], Filters: [{ Field: 'warehouse', Ids: [2968] }, { Field: 'warehouse', Ids: [2975] }],
      FilterExpression: { Version: 1, Root: { Kind: 2, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 1 }] } } })
  })

  it('copies a row with its values and blocks the run until the copy is placed in the tree', async () => {
    treeCapability()
    render(panel())
    const top = await addFilter('Топ')
    await pick(top, 'A')
    fireEvent.click(screen.getByRole('button', { name: 'Налаштувати групи І/АБО' }))
    fireEvent.mouseDown(top)
    const filters = await screen.findByRole('region', { name: 'Відбори' })
    const copy = within(filters).getByRole('button', { name: 'Копіювати вибраний відбір' })
    expect(copy).toHaveProperty('disabled', false)
    fireEvent.click(copy)
    const rows = within(filters).getAllByRole('group', { name: /^Умова відбору \d+$/ })
    expect(rows).toHaveLength(2)
    expect(within(rows[1]).getByRole('button', { name: 'Видалити A' })).toBeTruthy()
    expect((await screen.findAllByText(/Увімкнену умову №2 не включено до логіки/)).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', true)
  })

  it('combines movement filters with І/АБО groups and sends the named tree to an older server', async () => {
    oldServer(true)
    render(panel())
    const warehouse = await addFilter('Склад')
    fireEvent.click(within(warehouse).getByRole('combobox', { name: 'Значення' }))
    fireEvent.click(await screen.findByRole('option', { name: 'СКЛАД -1 · Фенікс' }))
    const top = await addFilter('Топ')
    fireEvent.click(within(top).getByRole('combobox', { name: 'Значення' }))
    fireEvent.click(await screen.findByRole('option', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: 'Налаштувати групи І/АБО' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Оператор — Коренева група' }))
    fireEvent.click(await screen.findByRole('option', { name: 'АБО — будь-яка умова' }))
    await applyReport()
    expect(previews()[0]).toMatchObject({ ProductTops: ['A'], FilterExpression: { Version: 1, Root: { Kind: 2,
      Children: [{ Kind: 3, Filter: 'warehouse' }, { Kind: 3, Filter: 'top' }] } } })
    fireEvent.click(screen.getByRole('button', { name: 'Видалити умову 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
    await waitFor(() => expect(previews()).toHaveLength(2))
    expect(previews()[1]).toMatchObject({ WarehouseIds: [], FilterExpression: { Root: { Kind: 2, Children: [{ Kind: 3, Filter: 'top' }] } } })
  })

  it('blocks a filter left outside the І/АБО tree', async () => {
    treeCapability()
    render(panel())
    const top = await addFilter('Топ')
    fireEvent.click(within(top).getByRole('combobox', { name: 'Значення' }))
    fireEvent.click(await screen.findByRole('option', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: 'Налаштувати групи І/АБО' }))
    const unit = await addFilter('Одиниця виміру')
    fireEvent.click(within(unit).getByRole('combobox', { name: 'Значення' }))
    fireEvent.click(await screen.findByRole('option', { name: 'шт' }))
    expect((await screen.findAllByText(/не включено до логіки/)).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', true)
  })

  it('shows a failed top list with a retry instead of an empty list', async () => {
    vi.mocked(searchCustomerGroupTop).mockRejectedValueOnce(new Error('offline'))
    render(panel())
    const value = within(await addFilter('Топ')).getByRole('combobox', { name: 'Значення' })
    fireEvent.click(value)
    expect((await screen.findByRole('alert')).textContent).toBe('Не вдалося завантажити значення.')
    fireEvent.click(screen.getByRole('option', { name: 'Спробувати ще раз' }))
    expect(await screen.findByRole('option', { name: 'A' })).toBeTruthy()
    expect(searchCustomerGroupTop).toHaveBeenCalledTimes(2)
  })

  it('switches a row off, deletes it and keeps one row per field for an older server', async () => {
    oldServer()
    render(panel())
    const row = await addFilter('Топ')
    fireEvent.click(within(row).getByRole('combobox', { name: 'Значення' }))
    fireEvent.click(await screen.findByRole('option', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: 'Додати відбір' }))
    const second = screen.getAllByRole('group', { name: /^Умова відбору \d+$/ })[1]
    fireEvent.click(within(second).getByRole('combobox', { name: 'Поле' }))
    expect((await screen.findByRole('option', { name: 'Топ' })).getAttribute('data-combobox-disabled')).toBe('true')
    fireEvent.click(screen.getByRole('option', { name: 'Склад' }))
    fireEvent.click(within(row).getByRole('checkbox', { name: 'Увімкнути умову 1' }))
    await applyReport()
    expect(previews()[0]).toMatchObject({ ProductTops: [], WarehouseIds: [] })
    fireEvent.click(within(row).getByRole('checkbox', { name: 'Увімкнути умову 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
    await waitFor(() => expect(previews()).toHaveLength(2))
    expect(previews()[1]).toMatchObject({ ProductTops: ['A'] })
    fireEvent.click(screen.getByRole('button', { name: 'Видалити умову 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
    await waitFor(() => expect(previews()).toHaveLength(3))
    expect(previews()[2]).toMatchObject({ ProductTops: [] })
    expect(screen.getAllByRole('group', { name: /^Умова відбору \d+$/ })).toHaveLength(1)
  })

  it('shows a failed product lookup with a retry instead of an empty list', async () => {
    vi.mocked(searchStockMovementProducts).mockRejectedValueOnce(new Error('offline'))
    render(panel())
    const products = within(await addFilter('Товар')).getByRole('combobox', { name: 'Значення' })
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
  expect(screen.getByText('«—» у підсумку: кількість частини руху не підтверджена партією, тому підсумок не визначено.')).toBeTruthy()
  expect(footer.querySelectorAll('th[title]')).toHaveLength(3)
  if (!empty) {
    const dashes = [...table.querySelectorAll('tbody td')].filter(cell => cell.textContent === '—')
    expect(dashes.length).toBeGreaterThan(0)
    expect(dashes.every(cell => cell.getAttribute('title') === 'Значення не визначено.')).toBe(true)
  }
  fireEvent.click(screen.getByRole('button', { name: 'Excel' }))
  await waitFor(() => expect(exportStockMovement).toHaveBeenCalledOnce())
  expect(vi.mocked(exportStockMovement).mock.calls[0][0]).toEqual({ ...previews()[0], Offset: 0, Limit: 1 })
  expect(footer.textContent).toBe('Підсумок———')
})

it('points an undetermined total without unconfirmed batches to the calculation notes', async () => {
  vi.mocked(previewStockMovement).mockImplementation(async request => ({
    ...stockMovementResult(request), Totals: { Opening: null, Incoming: null, Outgoing: null, Closing: null },
  }))
  render(panel())
  const table = await applyReport()
  expect(table.querySelector('tfoot')!.textContent).toBe('Підсумок————')
  expect(screen.getByText('«—» у підсумку: значення не визначено.')).toBeTruthy()
})

it('gives a document row with an unconfirmed batch its reason on every «—»', async () => {
  vi.mocked(previewStockMovement).mockImplementation(async request => ({
    ...stockMovementResult(request, stockMovementRows.map((row, index) => index === 0
      ? { ...row, Quantity: { Opening: null, Incoming: 0, Outgoing: null, Closing: null }, QuantityStatus: 'unconfirmed_batch' } : row)),
  }))
  render(panel())
  const table = await applyReport()
  const dashes = [...table.querySelectorAll('tbody tr')[0].querySelectorAll('td')].filter(cell => cell.textContent === '—')
  expect(dashes).toHaveLength(3)
  expect(dashes.every(cell => cell.getAttribute('title') === 'Кількість частини руху не підтверджена партією, тому значення не визначено.')).toBe(true)
  expect(table.querySelectorAll('tbody td[title]')).toHaveLength(3)
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
