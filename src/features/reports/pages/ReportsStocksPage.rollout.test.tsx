import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, exportStockReportPreview, previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets, purchaseDataset, stockDataset } from '../data/reportDatasets.test-fixtures'
import { groupedCashWorkbookDataset } from '../data/groupedCashPeriod.test-fixtures'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { BUG_1274_DISABLED_MESSAGE } from '../data/reportMigration'
import { ReportsStocksPage } from './ReportsStocksPage'
import { findOpenedWorkbook, findWorkbookLanding } from '../testing/workbookDesk'

const surface = vi.hoisted(() => ({ only: true }))
vi.mock('../reportSurfacePolicy', () => ({ get BUG_1274_ONLY_REPORT_SURFACE() { return surface.only } }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(), exportStockReportPreview: vi.fn(), previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
const resultSession = { ResultId: '11111111-2222-3333-4444-555555555555', RequestSha256: 'b'.repeat(64), ResultSha256: 'a'.repeat(64), ExpiresAtUtc: '2030-01-01T00:00:00Z' }
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); surface.only = true
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, groupedCashWorkbookDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: {
    Version: 1, ResultSha256: resultSession.ResultSha256, PresentationOnly: true, Request: null, ResultSession: resultSession,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
    RowSchema: [{ Caption: 'Дата' }], ColumnSchema: [{ Caption: 'Сума' }],
    Rows: [{ Ordinal: 0, SourceIndex: 1, Values: [{ Caption: '01.09.2026' }] }],
    Columns: [{ Ordinal: 0, SourceIndex: 2, Values: [{ Caption: 'Прихід' }] }],
    Cells: [{ RowSourceIndex: 1, ColumnSourceIndex: 2, Value: { Kind: 'decimal', Value: '12.50', Provenance: 'producerCell' } }],
  } })
  vi.mocked(exportStockReportPreview).mockResolvedValue({ document: { DocumentURL: '/files/cash.xlsx' }, raw: {} })
})
const page = () => <MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>

it('shows only BUG-1274 entry points, then previews and exports the actual cash workbook', async () => {
  const view = render(page())
  const switcher = await findOpenedWorkbook('Ведомость по денежным средствам.xls')
  expect(screen.queryByRole('button', { name: 'Валовий прибуток — як у 1С' })).toBeNull()
  expect(screen.queryByText('Готово')).toBeNull()
  expect(view.container.querySelector('a[href="/reports/registers"]')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Продажі за днями' })).toBeNull()
  expect(within(switcher).getAllByRole('button', { name: /^Відкрити / }).map(tab => tab.getAttribute('aria-label')))
    .toEqual(['Відкрити Ведомость по денежным средствам.xls'])
  expect(screen.queryByRole('combobox', { name: 'Звіт' })).toBeNull()
  expect(createStockReport).not.toHaveBeenCalled()
  expect(previewStockReport).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
  await screen.findByRole('region', { name: 'Таблиця попереднього перегляду' })
  expect(previewStockReport).toHaveBeenCalledOnce()
  expect(vi.mocked(previewStockReport).mock.calls[0][0].dataSource).toBe(40)
  expect(exportStockReportPreview).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати Excel' }))
  await screen.findByRole('link', { name: 'Завантажити Excel' })
  expect(exportStockReportPreview).toHaveBeenCalledExactlyOnceWith(resultSession)
  expect(previewStockReport).toHaveBeenCalledOnce()
  expect(createStockReport).not.toHaveBeenCalled()
})

it('lists enabled purchase and cash templates, hides unsupported stock templates and template order', async () => {
  vi.mocked(getServerReportTemplates).mockResolvedValue([
    { Id: '10000000-0000-0000-0000-000000000001', Revision: 1, Name: 'Шаблон надходжень', Data: defaultDatasetRequest(purchaseDataset, '2026-09-01', '2026-09-03') },
    { Id: '10000000-0000-0000-0000-000000000003', Revision: 1, Name: 'Старий склад', Data: defaultDatasetRequest(stockDataset, '2026-09-01', '2026-09-03') },
    { Id: '10000000-0000-0000-0000-000000000002', Revision: 1, Name: 'Шаблон коштів', Data: defaultDatasetRequest(groupedCashWorkbookDataset, '2026-09-01', '2026-09-03') },
  ])
  render(page())
  await findWorkbookLanding()
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  expect(await screen.findByRole('button', { name: 'Відкрити для редагування: Шаблон коштів' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Відкрити для редагування: Шаблон надходжень' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Старий склад/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Порядок шаблонів' })).toBeNull()
})

it('blocks generic datasets and the old special launch, then accepts the actual cash workbook when the BUG-1274-only surface is off', async () => {
  surface.only = false
  const view = render(page())
  await screen.findByRole('button', { name: 'Продажі за днями' })
  expect(screen.queryByRole('button', { name: 'Валовий прибуток — як у 1С' })).toBeNull()
  expect(view.container.querySelector('a[href="/reports/registers"]')).toBeNull()
  fireEvent.submit(view.container.querySelector('form')!)
  expect(createStockReport).not.toHaveBeenCalled()
  expect(previewStockReport).not.toHaveBeenCalled()
  expect(exportStockReportPreview).not.toHaveBeenCalled()
  await screen.findByText('Звіти 1С за зразками Excel')
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити Ведомость по денежным средствам.xls' }))
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0].dataSource).toBe(40)
})

it('refuses an existing template outside BUG-1274 instead of opening or submitting it when the BUG-1274-only surface is off', async () => {
  surface.only = false
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: '10000000-0000-0000-0000-000000000001', Revision: 1, Name: 'Старий склад', Data: defaultDatasetRequest(stockDataset, '2026-09-01', '2026-09-03') }])
  const view = render(page())
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Старий склад' }))
  expect(screen.getAllByText(BUG_1274_DISABLED_MESSAGE).length).toBeGreaterThan(0)
  fireEvent.submit(view.container.querySelector('form')!)
  expect(createStockReport).not.toHaveBeenCalled()
  expect(previewStockReport).not.toHaveBeenCalled()
  expect(exportStockReportPreview).not.toHaveBeenCalled()
})
