import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PageHeaderActionsProvider, PageSubmenuActionsSlot } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { searchAnalysisValues } from '../api/currentVparivanieAnalysisApi'
import { readCurrentVparivanieRegional } from '../api/currentVparivanieRegionalApi'
import { getReportHistorySettings } from '../api/reportHistoryApi'
import { analysisDataset } from '../data/currentVparivanieAnalysis.test-fixtures'
import hierarchy from '../data/currentVparivanieAnalysis.hierarchy-capability-fixture.json'
import { regionalResult } from '../data/currentVparivanieRegional.test-fixtures'
import { profitDayDataset } from '../data/profitReadMode.test-fixtures'
import { rememberHistoryRun } from '../data/reportHistory'
import { changeReportPeriod } from '../testing/reportPeriod'
import { findOpenedWorkbook } from '../testing/workbookDesk'
import type { ReportRequestBody } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/currentVparivanieAnalysisApi', async original => ({ ...await original<typeof import('../api/currentVparivanieAnalysisApi')>(),
  searchAnalysisValues: vi.fn(), getAnalysisHierarchyStatus: vi.fn().mockResolvedValue({ productGroup: null, counterpartyGroup: null, warehouseGroup: null }) }))
vi.mock('../api/currentVparivanieRegionalApi', () => ({ readCurrentVparivanieRegional: vi.fn() }))
vi.mock('../api/reportHistoryApi', () => ({ getReportHistorySettings: vi.fn() }))

const dataset = { ...analysisDataset, currentVparivanie: { ...analysisDataset.currentVparivanie as object, analysis: hierarchy } }

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([profitDayDataset, dataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockImplementation(async (source, field) => source === 39 && field === 4
    ? [{ Id: '4425', Name: 'AL-KO [4425]' }] : [])
  vi.mocked(searchAnalysisValues).mockResolvedValue([])
  vi.mocked(readCurrentVparivanieRegional).mockResolvedValue(regionalResult())
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
    RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [],
  } })
})

function page() {
  render(<MantineProvider env="test"><I18nProvider><PageHeaderActionsProvider>
    <PageSubmenuActionsSlot /><ReportsStocksPage />
  </PageHeaderActionsProvider></I18nProvider></MantineProvider>)
}

function expectRegionalRequest(request: ReportRequestBody) {
  expect(request).not.toHaveProperty('currentVparivanieAnalysis')
  expect(request.sorted.Row.map(item => item.type)).toEqual([5])
  expect(request.sorted.Col.map(item => item.type)).toEqual([74, 75])
  expect(request.selections).toMatchObject([
    { SelectedField: { Type: 4 }, FilterCondition: { Type: 6 }, Values: [{ Data: { Id: '4425' } }] },
  ])
}

it('opens the regional form from the «Аналіз залишків і продажів» menu entry after a build', async () => {
  page()
  await findOpenedWorkbook('ВП.xls')
  fireEvent.click(screen.getByRole('button', { name: 'Особливі звіти' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Аналіз залишків і продажів' }))
  await findOpenedWorkbook('Впарювання.xls')
  changeReportPeriod({ from: '2026-10-01', to: '2026-10-31' })
  await waitFor(() => expect(screen.getByText('Група: AL-KO')).toBeTruthy())
  fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(previewStockReport).mock.calls[0][0]).toHaveProperty('currentVparivanieAnalysis')
  const regional = screen.getByRole('button', { name: 'Показати регіональну форму' })
  await waitFor(() => expect(regional).toHaveProperty('disabled', false))
  fireEvent.click(regional)
  await waitFor(() => expect(readCurrentVparivanieRegional).toHaveBeenCalledOnce())
  expectRegionalRequest(vi.mocked(readCurrentVparivanieRegional).mock.calls[0][1])
  expect(await screen.findByRole('rowheader', { name: 'Товар А' })).toBeTruthy()
})

it('reopens a regional history entry and forms the regional table again', async () => {
  vi.mocked(getReportHistorySettings).mockResolvedValue({ kind: 'regional', data: {
    dataSource: 39, from: '2026-10-01', to: '2026-10-31', currentVparivanieFullScope: true,
    sorted: { Row: [{ type: 5, label: 'Товар', key: 'Product' }],
      Col: [{ type: 74, label: 'Показник', key: 'CurrentVparivanieGroup' }, { type: 75, label: 'Покупець (деталізація)', key: 'CurrentVparivanieCounterparty' }],
      Measurements: [{ Label: 'Результат', Type: 83, parentName: 'Результат', Name: 'Результат', IsChecked: true }] },
    selections: [{ IsChecked: true, SelectedField: { Name: 'ProductGroup', Type: 4 }, FilterCondition: { Name: 'У групі', Type: 6 },
      Values: [{ Name: 'AL-KO', Value: 0, Data: { Id: '4425', Name: 'AL-KO' } }] }],
  } as ReportRequestBody })
  rememberHistoryRun('11111111-1111-1111-1111-111111111111', 'open')
  page()
  await waitFor(() => expect(readCurrentVparivanieRegional).toHaveBeenCalledOnce())
  expectRegionalRequest(vi.mocked(readCurrentVparivanieRegional).mock.calls[0][1])
  expect(previewStockReport).not.toHaveBeenCalled()
  expect(await screen.findByRole('rowheader', { name: 'Товар А' })).toBeTruthy()
})
