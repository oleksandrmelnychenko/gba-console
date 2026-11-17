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

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportHistoryApi', () => ({ getReportHistorySettings: vi.fn() }))
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
  vi.mocked(getReportHistorySettings).mockResolvedValue(saved())
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
