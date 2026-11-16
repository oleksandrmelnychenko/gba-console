import fixture from '../data/constructorDatasets.dev-fixture.json'
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { searchNativePriceFilters } from '../api/nativePriceFilterLookup'
import { getReportDatasets, getServerReportTemplates, parseReportDatasets } from '../api/reportWorkspaceApi'
import { NATIVE_PRICE_COMPARISON_WORKBOOK } from '../data/nativePriceComparison'
import { workbookDisplayFileName } from '../data/bug1274WorkbookGuide'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: null, hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/nativePriceFilterLookup', async original => ({ ...await original<typeof import('../api/nativePriceFilterLookup')>(), searchNativePriceFilters: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue(parseReportDatasets(fixture))
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: '844', Name: 'ЦЗ' }])
  vi.mocked(searchNativePriceFilters).mockImplementation(async (_, field) => field === 3
    ? [{ Id: 'A', Name: 'A' }] : [{ Id: '4425', Name: 'AL-KO [4425]' }])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
    RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [],
  } })
})
afterEach(cleanup)

it.each([
  { field: 3, label: 'Топ', key: 'ProductTop', value: 'A', data: { Name: 'A' } },
  { field: 4, label: 'Товарна група', key: 'ProductGroup', value: 'AL-KO [4425]', data: { Id: '4425' } },
])('uses canonical $label in the price comparison filter and preserves its request identity', async ({ field, label, key, value, data }) => {
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  fireEvent.click(await screen.findByRole('button', { name: `Відкрити ${workbookDisplayFileName(NATIVE_PRICE_COMPARISON_WORKBOOK)}` }))
  fireEvent.click(await screen.findByRole('combobox', { name: 'Тип ціни для порівняння' }))
  fireEvent.click(await screen.findByRole('option', { name: 'ЦЗ' }))
  fireEvent.click(screen.getByRole('button', { name: 'Додати відбір' }))
  fireEvent.click(screen.getByRole('combobox', { name: 'Поле' }))
  expect(screen.getByRole('option', { name: 'Топ' })).toBeTruthy()
  expect(screen.getByRole('option', { name: 'Товарна група' })).toBeTruthy()
  expect(screen.queryByRole('option', { name: 'Поточний TOP товару' })).toBeNull()
  expect(screen.queryByRole('option', { name: 'Поточні прямі групи товару' })).toBeNull()
  fireEvent.click(screen.getByRole('option', { name: label }))
  expect(screen.getByRole('combobox', { name: 'Поле' })).toHaveProperty('value', label)
  await waitFor(() => expect(searchNativePriceFilters).toHaveBeenCalledWith(46, field, expect.objectContaining({ value: '', offset: 0, limit: 30 }), expect.any(AbortSignal)))
  fireEvent.click(screen.getByRole('combobox', { name: 'Значення' }))
  fireEvent.click(await screen.findByRole('option', { name: value }))
  fireEvent.submit(view.container.querySelector('form.workbook-desk__form')!)
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 46, selections: [{
    SelectedField: { Type: field, Name: key }, FilterCondition: { Type: 0 }, Values: [{ Data: data, Name: value }],
  }] })
})
