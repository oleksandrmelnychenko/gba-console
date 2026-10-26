import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { profitDayDataset } from '../data/profitReadMode.test-fixtures'
import { salesByResponsiblesDataset } from '../data/salesByResponsibles.test-fixtures'
import type { NativeReportPreview } from '../data/nativeReportPreview'
import { findOpenedWorkbook } from '../testing/workbookDesk'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../reportSurfacePolicy', () => ({ BUG_1274_ONLY_REPORT_SURFACE: true }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: null, hasPermission: () => true }) }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: vi.fn(() => null) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(), previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))

const organizations = ['ТОВ «АМГ «КОНКОРД»', 'Фенікс', 'ФОП Самолюк Алла Дмитрівна', 'ФОП Самолюк Юрій Миколайович']
const preview: NativeReportPreview = {
  Version: 1, ResultSha256: 'b'.repeat(64), PresentationOnly: true,
  Request: { DataSource: 'NativeSalesByResponsibles', IsCurrentSnapshot: false, ObservationStartedAtUtc: null,
    ObservationCompletedAtUtc: null, HasPeriod: true, PeriodFrom: '01.10.2026', PeriodTo: '25.10.2026',
    ComparisonPeriodFrom: null, ComparisonPeriodTo: null, RowGroupings: ['Організація', 'Документ продажу. Відповідальний'],
    ColumnGroupings: ['Замовлення покупця. Відповідальний'], Measures: ['Сума продажу без ПДВ, EUR'], Filters: [], IgnoredFilters: [], Notes: [] },
  Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
  RowSchema: [{ Caption: 'Організація' }, { Caption: 'Документ продажу. Відповідальний' }],
  ColumnSchema: [{ Caption: 'Замовлення покупця. Відповідальний' }],
  Rows: [{ Ordinal: 0, SourceIndex: 0, Values: [{ Caption: 'Фенікс' }, { Caption: 'Баранов Віталій Васильович' }] }],
  Columns: [{ Ordinal: 0, SourceIndex: 0, Values: [{ Caption: 'Повернення (без замовлення)' }] }],
  Cells: [{ RowSourceIndex: 0, ColumnSourceIndex: 0, Value: { Kind: 'decimal', Value: '-172.81', Provenance: 'producerCell' } }],
}

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, profitDayDataset, salesByResponsiblesDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockImplementation(async (dataSource, field) => dataSource === 43 && field === 0
    ? organizations.map((Name, index) => ({ Id: String(10561 + index), Name })) : [])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: { DocumentURL: '/Data/reports/managers.xlsx' }, raw: {} }, preview })
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/Data/reports/managers.xlsx' }, raw: {} })
})

it('opens «Продажі по менеджерах» as a workbook tab and previews the native 1C layout', async () => {
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  const switcher = await findOpenedWorkbook('ВП.xls')
  expect(within(switcher).getByRole('button', { name: 'Знімок 1С: продажі за відповідальними' })).toBeTruthy()
  fireEvent.click(within(switcher).getByRole('button', { name: 'Відкрити Продажі по менеджерам.xls' }))
  await findOpenedWorkbook('Продажі по менеджерам.xls')
  await waitFor(() => expect(screen.queryByText(/застосовуються відбори книги/i)).toBeNull())
  expect(searchDatasetReportValues).toHaveBeenCalledWith(43, 0, expect.objectContaining({ value: '' }), undefined, undefined,
    undefined, undefined, undefined)
  await waitFor(() => expect((screen.getByRole('button', { name: 'Застосувати й показати' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  const request = vi.mocked(previewStockReport).mock.calls[0][0]
  expect(request.dataSource).toBe(43)
  expect(request.sorted.Row.map(row => row.type)).toEqual([4, 22])
  expect(request.sorted.Col.map(column => column.type)).toEqual([23])
  expect(request.sorted.Measurements.filter(measure => measure.IsChecked !== false).map(measure => measure.Type)).toEqual([2, 4])
  expect(request.selections).toHaveLength(1)
  expect(request.selections[0]).toMatchObject({ SelectedField: { Type: 0 }, FilterCondition: { Type: 2 } })
  expect(request.selections[0].Values.map(value => value.Name)).toEqual(organizations)
  const cell = await screen.findByText(/172,81|172\.81/)
  expect(cell.closest('td')?.className).toContain('is-negative')
})
