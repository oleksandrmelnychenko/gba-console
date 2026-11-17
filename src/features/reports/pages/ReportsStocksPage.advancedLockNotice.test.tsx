import fixture from '../data/constructorDatasets.dev-fixture.json'
import measurements from '../data/salesMeasurements.dev-fixture.json'
import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { getReportDatasets, getServerReportTemplates, parseReportDatasets } from '../api/reportWorkspaceApi'
import { previewStockReport } from '../api/reportsApi'
import { ReportsStocksPage } from './ReportsStocksPage'

const auth = vi.hoisted(() => ({ canGenerate: true }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: null, hasPermission: (key: string) => auth.canGenerate || key !== PermissionKeys.ReportsStocks.Report.Generate }) }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), previewStockReport: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); auth.canGenerate = true
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  const dataset = parseReportDatasets(fixture.map(item => item.DataSource === 2 ? { ...item, Measurements: measurements } : item)).find(item => item.DataSource === 2)!
  expect(dataset.Groupings).toHaveLength(23)
  expect(dataset.Measurements).toHaveLength(18)
  expect(dataset.Filters).toHaveLength(18)
  vi.mocked(getReportDatasets).mockResolvedValue([dataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
})
afterEach(cleanup)

async function openAdvanced() {
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  const navigation = await screen.findByRole('navigation', { name: 'Звіти' })
  fireEvent.click(await within(navigation).findByRole('button', { name: 'Відкрити Валовий прибуток' }))
  fireEvent.click(screen.getByRole('button', { name: 'Додаткові налаштування' }))
  return view
}

function expectLockedWithoutNotice() {
  expect(screen.queryAllByText(/Редагування недоступне під час завантаження/)).toHaveLength(0)
  for (const name of ['TOP цілих груп', 'Поріг групування', 'ABC-класифікація', 'Сортування значень груп']) {
    const panel = screen.getByRole('region', { name })
    const controls = panel.querySelectorAll('button, input')
    expect(controls.length).toBeGreaterThan(0)
    for (const control of controls) expect(control).toHaveProperty('disabled', true)
  }
  expect(within(screen.getByRole('region', { name: 'Сортування значень груп' })).getAllByRole('combobox')).toHaveLength(4)
}

it('removes repeated notices while gross profit is generating and restores editable settings afterward', async () => {
  let complete!: (value: Awaited<ReturnType<typeof previewStockReport>>) => void
  vi.mocked(previewStockReport).mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const { container } = await openAdvanced()
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  const request = vi.mocked(previewStockReport).mock.calls[0][0]
  expect(request).toMatchObject({ dataSource: 2, reportProfile: 'grossProfit' })
  expect(request.sorted.Row.map(field => field.type)).toEqual([4, 10, 7])
  expect(request.sorted.Col.map(field => field.type)).toEqual([2])
  expectLockedWithoutNotice()
  await act(async () => complete({ result: { document: {}, raw: {} }, preview: { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null, Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false }, RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [] } }))
  const top = screen.getByRole('button', { name: 'Увімкнути TOP цілих груп' })
  expect(top).toHaveProperty('disabled', false)
  fireEvent.click(top)
  expect(screen.getByRole('button', { name: 'Вимкнути TOP: залишити всі групи' })).toHaveProperty('disabled', false)
  const ordering = within(screen.getByRole('region', { name: 'Сортування значень груп' }))
  fireEvent.click(ordering.getAllByRole('combobox')[0])
  fireEvent.click(await screen.findByRole('option', { name: 'За значенням поля' }))
  expect(ordering.getAllByRole('combobox')[0]).toHaveProperty('value', 'За значенням поля')
  expect(screen.getByText(/Залиште в рядках одне початкове поле/)).toBeTruthy()
})

it('removes editing controls without repeated notices when report generation permission is revoked', async () => {
  const { rerender } = await openAdvanced()
  auth.canGenerate = false
  rerender(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  expect(screen.queryAllByText(/Редагування недоступне під час завантаження/)).toHaveLength(0)
  expect(screen.queryByRole('button', { name: 'Увімкнути TOP цілих груп' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Вимкнути TOP: залишити всі групи' })).toBeNull()
  expect(previewStockReport).not.toHaveBeenCalled()
})
