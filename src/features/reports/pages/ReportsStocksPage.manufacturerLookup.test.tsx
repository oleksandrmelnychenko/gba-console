import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PageHeaderActionsProvider, PageSubmenuActionsSlot } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getReportDatasets, getServerReportTemplates, parseReportDatasets } from '../api/reportWorkspaceApi'
import { previewStockReport } from '../api/reportsApi'
import { defaultDatasetRequest } from '../data/reportDatasets'
import catalog from '../data/reportCatalog.server-fixture.json'
import { netDataset } from '../data/reportDatasets.test-fixtures'
import { SALES_CONSTRUCTOR_WORKBOOK, salesConstructorRequest } from '../data/salesConstructorProfiles'
import type { ReportDataset, ReportFilterNode, ReportSelection } from '../types'
import { chosenGoodsSuppliers, NO_GOODS_SUPPLIERS, ReportsStocksPage, SelectionValuePicker } from './ReportsStocksPage'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: null, hasPermission: () => true }) }))
vi.mock('../api/reportWorkspaceApi', async original => ({
  ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(),
}))
vi.mock('../api/reportsApi', async original => ({
  ...await original<typeof import('../api/reportsApi')>(), previewStockReport: vi.fn(),
}))
const api = vi.mocked(apiRequest)
const manufacturers = [{ Id: 4383, Name: 'MARSTECH' }, { Id: 4384, Name: 'AYFAR' }]
const supplier: ReportSelection = { IsChecked: true, SelectedField: { Type: 17, Name: 'Постачальник' },
  FilterCondition: { Type: 2, Name: 'У списку' }, Values: [{ Data: { Id: 635333 }, Name: 'ПЛА-ТАН', Value: 0 }, { Data: { Id: 631635 }, Name: 'ПЛА-ТАН', Value: 0 }] }
const supplierRow = (condition: number, ...ids: number[]): ReportSelection => ({
  ...supplier, FilterCondition: { Type: condition, Name: '' },
  Values: ids.map(Id => ({ Data: { Id }, Name: String(Id), Value: 0 })),
})
const leaf = (SelectionIndex: number): ReportFilterNode => ({ Kind: 3, SelectionIndex })
const group = (Kind: 1 | 2, ...Children: ReportFilterNode[]): ReportFilterNode => ({ Kind, Children })
const expression = (Root: ReportFilterNode) => ({ Version: 1, Root })
function Picker({ dataSource = 2, others = [] }: { dataSource?: number; others?: ReportSelection[] }) {
  const [selection, setSelection] = useState<ReportSelection>({ IsChecked: true,
    SelectedField: { Type: 75, Name: 'Виробник' }, FilterCondition: { Type: 2, Name: 'У списку' }, Values: [] })
  return <MantineProvider env="test"><I18nProvider>
    <SelectionValuePicker dataSource={dataSource} selection={selection} selections={[...others, selection]} from="2025-10-01" to="2025-10-31"
      label="Виробник" onChange={Values => setSelection(previous => ({ ...previous, Values }))} />
    <output data-testid="selected">{JSON.stringify(selection.Values)}</output>
  </I18nProvider></MantineProvider>
}
const selected = () => JSON.parse(screen.getByTestId('selected').textContent!)
beforeEach(() => {
  api.mockReset(); api.mockResolvedValue(manufacturers)
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})
afterEach(cleanup)

it('searches the brand folders on the server and keeps exact identities', async () => {
  render(<Picker />)
  const input = screen.getByRole('combobox', { name: 'Виробник' })
  fireEvent.click(input)
  await waitFor(() => expect(api).toHaveBeenCalledWith('/report/datasets/lookup', expect.objectContaining({
    query: { dataSource: 2, field: 75, value: '', offset: 0, limit: 50 }, signal: expect.any(AbortSignal),
  })))
  fireEvent.change(input, { target: { value: 'MARS' } })
  await waitFor(() => expect(api).toHaveBeenLastCalledWith('/report/datasets/lookup', expect.objectContaining({
    query: { dataSource: 2, field: 75, value: 'MARS', offset: 0, limit: 50 } })))
  fireEvent.click(await screen.findByRole('option', { name: 'MARSTECH' }))
  await waitFor(() => expect(selected().map((value: { Data: { Id: number } }) => value.Data.Id)).toEqual([4383]))
})

it('narrows the manufacturers to the chosen goods suppliers', async () => {
  render(<Picker dataSource={3} others={[supplier]} />)
  fireEvent.click(screen.getByRole('combobox', { name: 'Виробник' }))
  await waitFor(() => expect(api).toHaveBeenCalledWith('/report/datasets/lookup', expect.objectContaining({
    query: { dataSource: 3, field: 75, value: '', offset: 0, limit: 50, supplierIds: '631635,635333' } })))
  expect(await screen.findByRole('option', { name: 'AYFAR' })).toBeTruthy()
})

it('loads every brand page instead of stopping at the first one', async () => {
  const page = (from: number, count: number) => Array.from({ length: count }, (_, index) => ({ Id: from + index, Name: `Бренд ${from + index}` }))
  api.mockReset()
  api.mockResolvedValueOnce(page(1, 50)).mockResolvedValueOnce(page(51, 23))
  render(<Picker />)
  fireEvent.click(screen.getByRole('combobox', { name: 'Виробник' }))
  expect(await screen.findByRole('option', { name: 'Бренд 73' })).toBeTruthy()
  expect(api).toHaveBeenNthCalledWith(2, '/report/datasets/lookup', expect.objectContaining({
    query: { dataSource: 2, field: 75, value: '', offset: 50, limit: 50 } }))
})

it('narrows by every active supplier condition together', () => {
  expect(chosenGoodsSuppliers([supplierRow(2, 1, 2, 3), supplierRow(2, 2, 3, 4), supplierRow(4, 3)])).toEqual([2])
  expect(chosenGoodsSuppliers([supplierRow(2, 1), supplierRow(2, 2)])).toBe(NO_GOODS_SUPPLIERS)
  expect(chosenGoodsSuppliers([supplierRow(4, 1)])).toEqual([])
})

it('projects nested supplier logic with exclusions, unchecked rows and unrelated alternatives', () => {
  const rows = [supplierRow(2, 1, 2), supplierRow(0, 3), supplierRow(1, 2),
    { ...supplierRow(0, 4), IsChecked: false }, { ...supplierRow(0, 99), SelectedField: { Type: 0, Name: 'Організація' } }]
  expect(chosenGoodsSuppliers(rows, expression(group(1, group(2, leaf(0), group(2, leaf(1), leaf(3))), leaf(2), leaf(4))))).toEqual([1, 2, 3])
  expect(chosenGoodsSuppliers(rows, expression(group(2, group(1, leaf(0), leaf(2)), leaf(4))))).toEqual([])
  expect(chosenGoodsSuppliers(rows, expression(group(1, group(2, leaf(0), leaf(4)), leaf(1))))).toEqual([3])
  expect(chosenGoodsSuppliers(rows, expression(group(2, leaf(3))))).toEqual([])
  expect(chosenGoodsSuppliers([rows[0], rows[1]], undefined, true)).toEqual([3])
  expect(chosenGoodsSuppliers(rows, expression(group(2, leaf(0), leaf(2))))).toEqual([])
})

it('refreshes the manufacturer picker when the sales constructor switches supplier conditions to OR', async () => {
  localStorage.clear()
  sessionStorage.clear()
  const dataset: ReportDataset = {
    ...netDataset, reportProfiles: ['sales'],
    Filters: [...netDataset.Filters, { Type: 17, Name: 'Постачальник товару' }, { Type: 75, Name: 'Виробник' }],
    FilterExpression: { Version: 1, Operators: [1, 2], MaximumDepth: 8, MaximumLeaves: 64, MaximumNodes: 128 },
  }
  const data = salesConstructorRequest(defaultDatasetRequest(dataset, '2026-10-01', '2026-10-31'), SALES_CONSTRUCTOR_WORKBOOK, dataset)
  const original = expression(group(1, group(1, leaf(0), leaf(1)), leaf(2)))
  const after = expression(group(1, group(2, leaf(0), leaf(1)), leaf(2)))
  const selectedManufacturer: ReportSelection = {
    IsChecked: true, SelectedField: { Type: 75, Name: 'Виробник' },
    FilterCondition: { Type: 0, Name: 'Дорівнює' },
    Values: [{ Name: 'AYFAR', Data: { Id: 4384 }, Value: 0 }],
  }
  vi.mocked(getReportDatasets).mockResolvedValue([dataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 1, Name: 'Виробники двох постачальників',
    Data: { ...data, selections: [supplierRow(0, 631635), supplierRow(0, 635333), selectedManufacturer], filterExpression: original } }])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
    RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [],
  } })
  let completePrevious: ((value: unknown) => void) | undefined
  let previousSignal: AbortSignal | undefined
  api.mockImplementation(async (_path, options) => {
    if (options?.query?.field !== 75) return []
    if (options.query.supplierIds === '631635') {
      previousSignal = options.signal ?? undefined
      return new Promise(resolve => { completePrevious = resolve })
    }
    return manufacturers
  })
  const { container } = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Виробники двох постачальників' }))
  await waitFor(() => expect(previousSignal).toBeDefined())
  fireEvent.click(screen.getByRole('combobox', { name: 'Оператор — Група 1' }))
  fireEvent.click(await screen.findByRole('option', { name: 'АБО — будь-яка умова' }))
  await waitFor(() => expect(api).toHaveBeenCalledWith('/report/datasets/lookup', expect.objectContaining({
    query: { dataSource: 2, field: 75, value: '', offset: 0, limit: 50, supplierIds: '631635,635333' },
  })))
  const filter = within(screen.getByRole('group', { name: 'Умова відбору 3' }))
  const field = filter.getByRole('combobox', { name: 'Поле' })
  expect(field).toHaveProperty('value', 'Виробник')
  fireEvent.mouseDown(field)
  fireEvent.click(field)
  expect(screen.getByRole('listbox')).toBeTruthy()
  expect(screen.queryByRole('option', { name: 'Виробник' })).toBeNull()
  fireEvent.blur(field)
  expect(screen.getByRole('button', { name: 'Копіювати вибраний відбір' })).toHaveProperty('disabled', true)
  fireEvent.click(filter.getByRole('combobox', { name: 'Значення' }))
  expect(await screen.findByRole('option', { name: 'MARSTECH' })).toBeTruthy()
  expect(previousSignal?.aborted).toBe(true)
  await act(async () => completePrevious?.([{ Id: 5001, Name: 'Попередній відбір' }]))
  expect(screen.queryByRole('option', { name: 'Попередній відбір' })).toBeNull()
  await act(async () => fireEvent.submit(container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledWith(expect.objectContaining({
    filterExpression: after, selections: expect.arrayContaining([selectedManufacturer]),
  }), dataset, expect.anything()))
  fireEvent.click(filter.getByRole('button', { name: 'Видалити умову 3' }))
  expect(screen.queryByRole('group', { name: 'Умова відбору 3' })).toBeNull()
})

const folder = { kind: 'counterpartyGroup', world: 'fenix', id: '8AB2005056C0000811DEFF56BB200610' }
const folderName = 'Постачальники товару'
it('applies the buyer group without offering a new manufacturer filter', async () => {
  const sales = parseReportDatasets(catalog).find(item => item.DataSource === 2)!
  const dataset = { ...sales, Filters: [...sales.Filters, { Type: 75, Name: 'Виробник', Selectable: true }] }
  api.mockImplementation(async path => {
    if (path.endsWith('/hierarchy-status')) return { version: 1, kinds: ['counterpartyGroup', 'warehouseGroup', 'productGroup'].map(kind => ({ kind, available: true })) }
    if (path.endsWith('/hierarchy')) return { kind: folder.kind, parentId: null, hasMore: false, items: [{
      id: 'fenix:' + folder.id, name: folderName, path: folderName, hasChildren: false, data: JSON.stringify(folder) }] }
    return []
  })
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
    RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [],
  } })
  vi.mocked(getReportDatasets).mockResolvedValue([dataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  const { container } = render(<MantineProvider env="test"><I18nProvider><PageHeaderActionsProvider>
    <PageSubmenuActionsSlot /><ReportsStocksPage />
  </PageHeaderActionsProvider></I18nProvider></MantineProvider>)
  const nav = await screen.findByRole('navigation', { name: 'Розділи звітів' })
  const salesMenu = within(nav).getByRole('button', { name: 'Продажі' })
  await waitFor(() => expect(salesMenu).toHaveProperty('disabled', false))
  fireEvent.click(salesMenu)
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Звіт по продажам' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Додати відбір' }))
  const row = within(screen.getByRole('group', { name: 'Умова відбору 1' }))
  fireEvent.click(row.getByRole('combobox', { name: 'Поле' }))
  expect(screen.queryByRole('option', { name: 'Виробник' })).toBeNull()
  fireEvent.click(await screen.findByRole('option', { name: 'Покупець (довідник)' }))
  fireEvent.click(within(await screen.findByRole('dialog', { name: 'Покупець' })).getByRole('button', { name: 'Застосувати' }))
  fireEvent.click(row.getByRole('combobox', { name: 'Тип порівняння' }))
  fireEvent.click(await screen.findByRole('option', { name: 'В групі' }))
  expect(screen.queryByRole('button', { name: 'Вибрати виробника' })).toBeNull()
  fireEvent.click(await screen.findByPlaceholderText('Пошук значення'))
  fireEvent.click(await screen.findByRole('option', { name: folderName }))
  expect(screen.queryByRole('button', { name: 'Вибрати виробника' })).toBeNull()
  expect(row.getByText('Група: ' + folderName)).toBeTruthy()
  await act(async () => fireEvent.submit(container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  const request = vi.mocked(previewStockReport).mock.calls[0][0]
  expect(request).toMatchObject({ dataSource: 2, reportProfile: 'sales', selections: [
    { SelectedField: { Type: 6 }, FilterCondition: { Type: 6 }, Values: [{ Data: folder }] },
  ] })
})
