import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PageHeaderActionsProvider, PageSubmenuActionsSlot } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getReportHistorySettings } from '../api/reportHistoryApi'
import { createStockReport, previewStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, parseReportDatasets } from '../api/reportWorkspaceApi'
import catalog from '../data/constructorDatasets.dev-fixture.json'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { REPORT_HISTORY_RUN_KEY, rememberHistoryRun } from '../data/reportHistory'
import type { ReportRequestBody } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'
import * as movementApi from '../api/warehouseStockMovementApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true, user: { NetUid: '99999999-9999-9999-9999-999999999999' } }) }))
vi.mock('../api/reportHistoryApi', () => ({ getReportHistorySettings: vi.fn() }))
vi.mock('../api/warehouseStockMovementApi', () => ({
  getStockMovementCapability: vi.fn(), getStockMovementWarehouses: vi.fn(), getStockMovementOrganizations: vi.fn(),
  getStockMovementMeasureUnits: vi.fn(), searchStockMovementProducts: vi.fn(), searchStockMovementGroups: vi.fn(),
  previewStockMovement: vi.fn(), exportStockMovement: vi.fn() }))
vi.mock('../api/customerGroupTopApi', () => ({ searchCustomerGroupTop: vi.fn(async () => ['A']) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  previewStockReport: vi.fn(), createStockReport: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))

const ID = '11111111-1111-1111-1111-111111111111'
const datasets = parseReportDatasets(catalog)
const purchases = datasets.find(item => item.DataSource === 3)!

function saved(): ReportRequestBody {
  const data = defaultDatasetRequest(purchases, '2026-11-01', '2026-11-17')
  data.sorted.Row = [...data.sorted.Row, { key: 'Gone', label: 'Старе групування', type: 999 }]
  return data
}

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue(datasets)
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(apiRequest).mockResolvedValue([])
  vi.mocked(getReportHistorySettings).mockResolvedValue({ kind: 'report', data: saved() })
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/Data/Reports/x.xlsx', PdfDocumentURL: '' }, raw: {} } as never)
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
    RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [],
  } } as never)
})
afterEach(cleanup)

function page() {
  return render(<MantineProvider env="test"><I18nProvider><PageHeaderActionsProvider>
    <PageSubmenuActionsSlot /><ReportsStocksPage />
  </PageHeaderActionsProvider></I18nProvider></MantineProvider>)
}

it('opens a history entry with its saved settings, builds it fresh and names what was dropped', async () => {
  rememberHistoryRun(ID, 'open')
  page()
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledTimes(1))
  expect(getReportHistorySettings).toHaveBeenCalledWith(ID)
  const request = vi.mocked(previewStockReport).mock.calls[0][0]
  expect(request.dataSource).toBe(3)
  expect(request.from).toBe('2026-11-01')
  expect(request.to).toBe('2026-11-17')
  expect(request.sorted.Row.some(item => item.type === 999)).toBe(false)
  expect(await screen.findByText(/Не застосовано, бо цього вже немає у звіті: Старе групування/)).toBeTruthy()
  expect(sessionStorage.getItem(REPORT_HISTORY_RUN_KEY)).toBeNull()
})

it('rebuilds the Excel file of a history entry without a screen build', async () => {
  rememberHistoryRun(ID, 'excel')
  page()
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(1))
  expect(previewStockReport).not.toHaveBeenCalled()
  expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 3, from: '2026-11-01', to: '2026-11-17' })
})

it('drops a filter value whose record no longer exists and names it in the one-line notice', async () => {
  const data = saved()
  data.selections = [{ IsChecked: true, SelectedField: { Type: 17, Name: 'Постачальник' }, FilterCondition: { Type: 0, Name: 'В списку' },
    Values: [{ Name: 'Старий постачальник', Value: 501, Data: { Id: 501, Name: 'Старий постачальник' } },
      { Name: 'Діючий постачальник', Value: 502, Data: { Id: 502, Name: 'Діючий постачальник' } }] }]
  vi.mocked(getReportHistorySettings).mockResolvedValue({ kind: 'report', data })
  vi.mocked(apiRequest).mockImplementation(async (path, options) => {
    if (path !== '/report/datasets/lookup') return []
    const value = (options?.query as { value?: string } | undefined)?.value ?? ''
    return value === '' || value === 'Діючий постачальник' ? [{ Id: 502, Name: 'Діючий постачальник' }] : []
  })
  rememberHistoryRun(ID, 'open')
  page()
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledTimes(1))
  const request = vi.mocked(previewStockReport).mock.calls[0][0]
  expect(request.selections.flatMap(selection => selection.Values.map(value => value.Value))).toEqual([502])
  expect(await screen.findByText(/Не застосовано, бо цього вже немає у звіті: .*Старий постачальник/)).toBeTruthy()
})

it('opens a stock movement entry in its own tab with current names and builds it once', async () => {
  const capability = { Version: 1, MinimumFrom: '2024-01-01', Today: '2026-11-17', StockSyncAt: null, Levels: ['warehouse', 'product'],
    DefaultLevels: ['warehouse'], Measures: ['opening', 'incoming', 'outgoing', 'closing'], Comparisons: [], ArticleMatches: ['equals'],
    DocumentKinds: [], MaximumLimit: 500, MaximumFilterRows: 10, Notes: [] }
  vi.mocked(movementApi.getStockMovementCapability).mockResolvedValue(capability as never)
  vi.mocked(movementApi.getStockMovementWarehouses).mockResolvedValue([{ Id: 1, Name: 'Склад 1', Detail: null }])
  vi.mocked(movementApi.getStockMovementOrganizations).mockResolvedValue([])
  vi.mocked(movementApi.getStockMovementMeasureUnits).mockResolvedValue([])
  vi.mocked(movementApi.exportStockMovement).mockResolvedValue({ DocumentURL: '/Data/Reports/m.xlsx', FileName: 'm.xlsx', TotalRows: 3 })
  vi.mocked(getReportHistorySettings).mockResolvedValue({ kind: 'movement', products: [{ Id: 7, Name: 'A-100', Detail: null }], groups: [],
    movement: { Version: 1, From: '2026-11-01', To: '2026-11-17', WarehouseIds: [], OrganizationIds: [], ProductIds: [], ArticleMatch: '',
      Articles: [], ProductGroupIds: [], ProductTops: [], MeasureUnitIds: [], DocumentKinds: [], DocumentText: null,
      Filters: [{ Field: 'warehouse', Ids: [1, 9] }, { Field: 'product', Ids: [7, 8] }], Conditions: [], Levels: ['warehouse', 'product'],
      Measures: ['opening', 'closing'], GrandTotals: true, NegativeRed: true, Offset: 0, Limit: 200 } })
  rememberHistoryRun(ID, 'excel')
  page()
  await waitFor(() => expect(movementApi.exportStockMovement).toHaveBeenCalledTimes(1))
  expect(movementApi.previewStockMovement).not.toHaveBeenCalled()
  expect(previewStockReport).not.toHaveBeenCalled()
  const request = vi.mocked(movementApi.exportStockMovement).mock.calls[0][0]
  expect(request.Filters?.map(filter => [filter.Field, filter.Ids])).toEqual([['warehouse', [1]], ['product', [7]]])
  expect(request).toMatchObject({ From: '2026-11-01', To: '2026-11-17', Measures: ['opening', 'closing'] })
  expect(await screen.findByText('Не застосовано, бо цього вже немає у звіті: Склад: 1 значення, Товар: 1 значення.')).toBeTruthy()
})
