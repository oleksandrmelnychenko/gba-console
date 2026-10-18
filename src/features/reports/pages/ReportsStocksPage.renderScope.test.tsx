import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { profitDayDataset } from '../data/profitReadMode.test-fixtures'
import type { NativeReportPreview } from '../data/nativeReportPreview'
import { CollectionCoefficientConstructorModal } from './CollectionCoefficientConstructorModal'
import { PlannedCashConstructorModal } from './PlannedCashConstructorModal'
import { ReportInlinePreview } from './ReportInlinePreview'
import { ReportsStocksPage } from './ReportsStocksPage'
import { findWorkbookLanding } from '../testing/workbookDesk'

vi.mock('../reportSurfacePolicy', () => ({ BUG_1274_ONLY_REPORT_SURFACE: true }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: () => null }))
vi.mock('./CollectionCoefficientConstructorModal', () => ({ CollectionCoefficientConstructorModal: vi.fn(() => null) }))
vi.mock('./PlannedCashConstructorModal', () => ({ PlannedCashConstructorModal: vi.fn(() => null) }))
vi.mock('./ReportInlinePreview', () => ({ ReportInlinePreview: vi.fn(() => <section aria-label="Попередній перегляд звіту" />) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), previewStockReport: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))

const preview: NativeReportPreview = {
  Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null,
  Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
  RowSchema: [{ Caption: 'Дата' }], ColumnSchema: [{ Caption: 'Сума' }],
  Rows: [{ Ordinal: 0, SourceIndex: 1, Values: [{ Caption: '01.09.2026' }] }],
  Columns: [{ Ordinal: 0, SourceIndex: 2, Values: [{ Caption: 'Продажі' }] }],
  Cells: [{ RowSourceIndex: 1, ColumnSourceIndex: 2, Value: { Kind: 'decimal', Value: '12.50', Provenance: 'producerCell' } }],
}

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, profitDayDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: { DocumentURL: '/files/day.xlsx' }, raw: {} }, preview })
})

const page = (consoleScope?: boolean) => <MantineProvider env="test"><I18nProvider>
  <ReportsStocksPage {...(consoleScope === undefined ? {} : { consoleScope })} />
</I18nProvider></MantineProvider>

it('does not mount the constructor dialogs the console catalogue cannot open', async () => {
  render(page())
  await findWorkbookLanding()
  expect(CollectionCoefficientConstructorModal).not.toHaveBeenCalled()
  expect(PlannedCashConstructorModal).not.toHaveBeenCalled()
})

it('keeps the constructor dialogs mounted where the full catalogue can open them', async () => {
  render(page(false))
  await waitFor(() => expect(getReportDatasets).toHaveBeenCalled())
  await waitFor(() => expect(CollectionCoefficientConstructorModal).toHaveBeenCalled())
  expect(PlannedCashConstructorModal).toHaveBeenCalled()
})

it('does not re-render the finished preview while the template name is typed', async () => {
  render(page())
  await findWorkbookLanding()
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити ВП.xls' }))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Показати на екрані' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Показати на екрані' }))
  await screen.findByRole('region', { name: 'Попередній перегляд звіту' })
  const renders = vi.mocked(ReportInlinePreview).mock.calls.length
  expect(vi.mocked(ReportInlinePreview).mock.calls.at(-1)?.[0]).toEqual({ preview })
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  const name = await screen.findByRole('textbox', { name: 'Назва шаблону' })
  for (const value of ['П', 'Пр', 'Пре']) fireEvent.change(name, { target: { value } })
  expect((name as HTMLInputElement).value).toBe('Пре')
  expect(screen.getByRole('region', { name: 'Попередній перегляд звіту' })).toBeTruthy()
  expect(vi.mocked(ReportInlinePreview).mock.calls.length).toBe(renders)
})

it('names the opened workbook in the report header and keeps its description behind «Про звіт»', async () => {
  render(page())
  await findWorkbookLanding()
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити ВП.xls' }))
  const header = await screen.findByRole('region', { name: 'Валовий прибуток' })
  expect(within(header).getByText('ВП.xls')).toBeTruthy()
  expect(within(header).getByText('Про звіт')).toBeTruthy()
  expect(within(header).getByText(/По днях і організаціях, період до 62 днів/)).toBeTruthy()
})
