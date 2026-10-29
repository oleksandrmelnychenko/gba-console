import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getReportDatasets, getServerReportTemplates, normalizeSavedTemplate, parseReportDatasets, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { searchDatasetReportValues } from '../api/reportsApi'
import fixture from '../data/purchaseWarehouse.server-fixture.json'
import { datasetConfigurationError, datasetFilters, datasetGroupings } from '../data/reportDatasets'
import { changeReportPeriod } from '../testing/reportPeriod'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), searchDatasetReportValues: vi.fn() }))
const dataset = parseReportDatasets([fixture.dataset])[0]
const storedData = {
  DataSource: 3, From: '2026-10-18', To: '2026-10-27',
  Sorted: { Row: [{ type: 29, key: 'Warehouse', label: 'Склад надходження' }, { type: 24, key: 'PurchaseDocument', label: 'Документ надходження' }],
    Col: [{ type: 21, key: 'Supplier', label: 'Постачальник' }], Measurements: [{ Type: 2, Name: 'CostWithoutVAT', IsChecked: true, parentName: 'Вартість' }] },
  Selections: [{ IsChecked: true, SelectedField: { Type: 21, Name: 'Warehouse' }, FilterCondition: { Type: 2, Name: 'У списку' },
    Values: [{ Data: { Id: 2963, Name: 'Склад' }, Name: 'Склад', Value: 2963 }, { Data: { Id: 2968, Name: 'Склад' }, Name: 'Склад', Value: 2968 }] }],
}
const template = () => normalizeSavedTemplate({ Id: 'purchase-warehouse-template', Revision: 1, UpdatedAtUtc: '2026-10-29T12:00:00Z', Name: 'Склади надходження', Data: storedData })
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([dataset]); vi.mocked(getServerReportTemplates).mockResolvedValue([template()])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: 2963, Name: 'Склад' }, { Id: 2968, Name: 'Склад' }])
  vi.mocked(saveServerReportTemplate).mockImplementation(async value => ({ ...value, Revision: 2 }))
})
afterEach(cleanup)
async function ready() {
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити gba:purchases-constructor:v1' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Відкрити gba:purchases-constructor:v1' })).toHaveProperty('ariaCurrent', 'true'))
  await screen.findByRole('button', { name: 'Додати умову' })
  return view
}

it('uses the actual source3 receipt label in grouping and offers only four flat filter operators', async () => {
  expect(datasetGroupings(dataset).find(field => field.type === 29)?.label).toBe('Склад надходження')
  expect(datasetFilters(dataset).find(field => field.field.Type === 21)?.label).toBe('Склад надходження')
  expect(dataset.Filters.find(field => field.Type === 21)?.hierarchy).toBeUndefined()
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Додати поле: Групування рядків' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Вибрати Склад надходження' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Додати вибрані (1)' }))
  expect(screen.getByRole('button', { name: 'Видалити Склад надходження' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Додати умову' }))
  fireEvent.click(screen.getByRole('combobox', { name: 'Поле' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Склад надходження' }))
  fireEvent.click(screen.getByRole('combobox', { name: 'Умова' }))
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Дорівнює', 'Не дорівнює', 'У списку', 'Не у списку'])
})

it('restores and saves exact same-name IDs, row/column order and edited dates without remapping the warehouse', async () => {
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Склади надходження' }))
  await screen.findByRole('button', { name: 'Видалити Склад надходження' })
  changeReportPeriod({ from: '2026-09-01', to: '2026-09-30' })
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
  await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
  const saved = vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data
  expect(saved).toMatchObject({ dataSource: 3, from: '2026-09-01', to: '2026-09-30' })
  expect(saved.sorted.Row.map(field => field.type)).toEqual([29, 24])
  expect(saved.sorted.Col.map(field => field.type)).toEqual([21])
  expect(saved.selections).toEqual(template().Data.selections)
  expect(datasetConfigurationError(saved, dataset)).toBeNull()
})

it.each([3, 5, 6, 7])('rejects a saved warehouse hierarchy operator%i without rewriting the selection', condition => {
  const request = structuredClone(template().Data)
  request.selections[0].FilterCondition.Type = condition
  const original = structuredClone(request)
  expect(datasetConfigurationError(request, dataset)).toContain('не підтримує налаштування')
  expect(request).toEqual(original)
})

it.each([0, 1])('keeps saved single-value condition%i visible but blocks generation until corrected', async condition => {
  const invalid = template()
  invalid.Data.selections[0].FilterCondition = { Type: condition, Name: condition === 0 ? 'Дорівнює' : 'Не дорівнює' }
  vi.mocked(getServerReportTemplates).mockResolvedValue([invalid])
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Склади надходження' }))
  await screen.findByRole('button', { name: 'Видалити Склад надходження' })
  expect(screen.getAllByText('Оберіть одне значення для цієї умови.').length).toBeGreaterThan(0)
  expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', true)
  expect(saveServerReportTemplate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('combobox', { name: 'Умова' }))
  fireEvent.click(screen.getByRole('option', { name: 'У списку' }))
  expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', false)
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
  await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
  const corrected = vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data
  expect(corrected.selections[0]).toEqual({ ...invalid.Data.selections[0], FilterCondition: { Type: 2, Name: 'У списку' } })
  expect(corrected.from).toBe(invalid.Data.from)
  expect(corrected.to).toBe(invalid.Data.to)
})


it.each([{ condition: 2, checked: true }, { condition: 4, checked: true }, { condition: 0, checked: false }, { condition: 1, checked: false }])(
  'allows multi-value or disabled warehouse condition $condition / checked=$checked', async ({ condition, checked }) => {
    const restored = template()
    restored.Data.selections[0].FilterCondition.Type = condition
    restored.Data.selections[0].IsChecked = checked
    vi.mocked(getServerReportTemplates).mockResolvedValue([restored])
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Склади надходження' }))
    await screen.findByRole('button', { name: 'Видалити Склад надходження' })
    expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', false)
    expect(restored.Data.selections[0].Values.map(value => value.Value)).toEqual([2963, 2968])
  },
)
