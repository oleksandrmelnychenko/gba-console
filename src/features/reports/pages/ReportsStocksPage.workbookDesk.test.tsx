import { movementDataset } from '../data/currentVparivanieMovements.test-fixtures'
import { workbookDisplayFileName } from '../data/bug1274WorkbookGuide'
import { changeReportPeriod, openReportPeriod, readReportDateInput } from '../testing/reportPeriod'
import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ApiError } from '../../../shared/api/apiClient'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { createStockReport, exportStockReportPreview, previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { getSettlementCounterpartyGroups } from '../api/counterpartyGroupsApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { profitDayDataset, profitSupplierDataset } from '../data/profitReadMode.test-fixtures'
import { cashModeDataset } from '../data/cashReadMode.test-fixtures'
import { settlementModeDataset } from '../data/settlementReadMode.test-fixtures'
import { currentVparivanieDataset } from '../data/currentVparivanie.test-fixtures'
import { previousKyivDay } from '../data/cashPeriod'
import type { NativeReportPreview } from '../data/nativeReportPreview'
import { deskPeriodText, workbookDefaultPeriod } from '../data/workbookDesk'
import { reportWorkspaceDraftKey } from '../data/reportWorkspaceDraft'
import { WORKBOOK_FILES } from '../testing/workbookFiles'
import { findOpenedWorkbook } from '../testing/workbookDesk'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../reportSurfacePolicy', () => ({ BUG_1274_ONLY_REPORT_SURFACE: true }))
const auth = vi.hoisted(() => ({ owner: null as string | null }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: auth.owner ? { NetUid: auth.owner } : null, hasPermission: () => true }) }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: vi.fn(() => null) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(), exportStockReportPreview: vi.fn(), previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/counterpartyGroupsApi', () => ({ getSettlementCounterpartyGroups: vi.fn() }))

const preview: NativeReportPreview = {
  Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null,
  Page: { Offset: 0, Limit: 50, TotalVisibleRows: 1, ReturnedRows: 1, HasMore: false },
  RowSchema: [{ Caption: 'Дата' }], ColumnSchema: [{ Caption: 'Сума' }],
  Rows: [{ Ordinal: 0, SourceIndex: 1, Values: [{ Caption: '01.09.2026' }] }],
  Columns: [{ Ordinal: 0, SourceIndex: 2, Values: [{ Caption: 'Продажі' }] }],
  Cells: [{ RowSourceIndex: 1, ColumnSourceIndex: 2, Value: { Kind: 'decimal', Value: '12.50', Provenance: 'producerCell' } }],
}
const files = { DocumentURL: '/Data/reports/day.xlsx', PdfDocumentURL: '/Data/reports/day.pdf' }

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); auth.owner = null
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, profitDayDataset, profitSupplierDataset,
    currentVparivanieDataset, cashModeDataset, settlementModeDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(getSettlementCounterpartyGroups).mockResolvedValue([])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: files, raw: {} }, preview })
  vi.mocked(createStockReport).mockResolvedValue({ document: files, raw: {} })
})

const page = () => <MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>
const dateInput = readReportDateInput
const workbookDataSources: Readonly<Record<string, number>> = {
  'ВП.xls': 35, 'ВП по постачальниках.xls': 38, 'Впарювання.xls': 39,
  'Ведомость по денежным средствам.xls': 40, 'Взаємороз всі.xls': 41, 'ДБіторка.xls': 41,
}

async function findOpenedDayWorkbook() {
  await findOpenedWorkbook('ВП.xls')
  await waitFor(() => expect((screen.getByRole('button', { name: 'Застосувати й показати' }) as HTMLButtonElement).disabled).toBe(false))
}

async function openDayWorkbook() {
  render(page())
  await findOpenedDayWorkbook()
}

it('opens every workbook from the switcher on its default period', async () => {
  render(page())
  const switcher = await findOpenedWorkbook('ВП.xls')
  for (const file of Object.values(WORKBOOK_FILES)) {
    const period = workbookDefaultPeriod(file, workbookDataSources[file], formatKyivBusinessDate())!
    fireEvent.click(within(switcher).getByRole('button', { name: `Відкрити ${workbookDisplayFileName(file)}` }))
    await findOpenedWorkbook(file)
    await waitFor(() => expect(screen.queryByText(/застосовуються відбори книги/i)).toBeNull())
    expect(deskPeriodText(dateInput('Від').value, dateInput('До').value)).toBe(deskPeriodText(period.from, period.to))
  }
})

it('shows the table with its row count and turns Excel and PDF into direct downloads of the same run', async () => {
  await openDayWorkbook()
  expect(screen.getByRole('button', { name: 'Сформувати Excel' })).toBeTruthy()
  expect(screen.getByText('Таблиці ще немає')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
  await screen.findByRole('region', { name: 'Таблиця попереднього перегляду' })
  expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 35, profitReadMode: 0 })
  expect(createStockReport).not.toHaveBeenCalled()
  expect(screen.getByText('1 рядок')).toBeTruthy()
  const excel = screen.getByRole('link', { name: 'Завантажити Excel' })
  expect(excel.getAttribute('href')).toContain('/Data/reports/day.xlsx')
  expect(excel.getAttribute('download')).toMatch(/^ВП \d\d\.\d\d\.\d{4}-\d\d\.\d\d\.\d{4}\.xlsx$/)
  expect(screen.getByRole('link', { name: 'Завантажити PDF' }).getAttribute('download')).toMatch(/\.pdf$/)
  changeReportPeriod({ from: dateInput('До').value })
  expect(screen.getByRole('region', { name: 'Таблиця попереднього перегляду' })).toBeTruthy()
  expect(screen.getByText(/Налаштування змінено\. Застосуйте/)).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Завантажити Excel' })).toBeTruthy()
})

it('forms a file with the request of the former «Сформувати» and opens the export dialog', async () => {
  await openDayWorkbook()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати PDF' }))
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 35, profitReadMode: 0, dayOrganizationBasis: 0 })
  expect(previewStockReport).not.toHaveBeenCalled()
  await waitFor(() => expect(vi.mocked(DocumentExportModal).mock.calls.at(-1)?.[0]).toMatchObject({ opened: true }))
  expect(screen.getByText('Файли сформовано')).toBeTruthy()
})

it('says why the actions are blocked and points the buttons at that reason', async () => {
  await openDayWorkbook()
  const yesterday = previousKyivDay(formatKyivBusinessDate())
  const period = openReportPeriod()
  fireEvent.change(within(period).getByLabelText('До'), { target: { value: previousKyivDay(yesterday) } })
  fireEvent.change(within(period).getByLabelText('Від'), { target: { value: yesterday } })
  expect(within(period).getByRole('button', { name: 'Застосувати' }).hasAttribute('disabled')).toBe(true)
  expect(within(period).getByRole('alert').textContent).toContain('Дата «Від» має бути не пізніше дати «До»')
  fireEvent.click(within(period).getByRole('button', { name: 'Скасувати' }))
  changeReportPeriod({ from: '' })
  await waitFor(() => expect(document.getElementById('report-constructor-blocked-reason')?.textContent).toMatch(/період/))
  for (const name of ['Застосувати й показати', 'Сформувати Excel', 'Сформувати PDF']) {
    const button = screen.getByRole('button', { name }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-describedby')).toBe('report-constructor-blocked-reason')
  }
})

it('shows what is happening while the report is formed and the server reason when it fails', async () => {
  let fail: (error: unknown) => void = () => {}
  vi.mocked(previewStockReport).mockImplementation(() => new Promise((_, reject) => { fail = reject }))
  await openDayWorkbook()
  fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
  expect(await screen.findByText(/^Формуємо «Валовий прибуток» за /)).toBeTruthy()
  expect(screen.getByText('Звіт формується…')).toBeTruthy()
  expect(screen.getByText('0 с')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Застосувати й показати' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Скинути' }) as HTMLButtonElement).disabled).toBe(true)
  await act(async () => fail(new ApiError('Internal', 500, null)))
  expect(await screen.findByText('Звіт не сформовано')).toBeTruthy()
  expect(screen.getByText('Сервер звітів недоступний. Спробуйте ще раз пізніше.')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Застосувати й показати' }) as HTMLButtonElement).disabled).toBe(false)
})

it('keeps the report list beside the open report instead of hiding the report behind «Усі звіти»', async () => {
  await openDayWorkbook()
  const day = previousKyivDay(formatKyivBusinessDate())
  changeReportPeriod({ from: day })
  const switcher = screen.getByRole('navigation', { name: 'Звіти' })
  expect(within(switcher).getAllByRole('button', { name: /^Відкрити / })).toHaveLength(6)
  expect(within(switcher).getByRole('button', { name: 'Відкрити ВП.xls' }).getAttribute('aria-current')).toBe('true')
  expect(screen.queryByRole('button', { name: 'Усі звіти' })).toBeNull()
  expect(screen.queryByRole('button', { name: /^Повернутися до звіту/ })).toBeNull()
  expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toBeTruthy()
  expect(dateInput('Від').value).toBe(day)
  expect(screen.queryByRole('heading', { name: 'Валовий прибуток' })).toBeNull()
})

it('shows period, filters, measures and grouping together in one settings form', async () => {
  await openDayWorkbook()
  expect(screen.queryByRole('button', { name: 'Змінити налаштування' })).toBeNull()
  expect(dateInput('Від')).toBeTruthy()
  for (const name of ['Організації', 'Відбори', 'Показники', 'Групування']) expect(screen.getByRole('group', { name })).toBeTruthy()
  expect((screen.getByRole('checkbox', { name: 'Група «Покупці» Fenix' }) as HTMLInputElement).checked).toBe(true)
})

it('keeps settings available without duplicating them in an about section', async () => {
  await openDayWorkbook()
  expect(screen.queryByText('Про звіт')).toBeNull()
  expect(dateInput('Від')).toBeTruthy()
  expect(screen.getByRole('group', { name: 'Організації' })).toBeTruthy()
  expect(screen.getByRole('group', { name: 'Відбори' })).toBeTruthy()
})

it('opens reports immediately while an earlier draft remains an optional recovery action', async () => {
  auth.owner = 'background-draft-owner'
  const first = render(page())
  await findOpenedDayWorkbook()
  changeReportPeriod({ from: '2026-09-02' })
  first.unmount()
  render(page())
  await findOpenedDayWorkbook()
  expect(dateInput('Від').value).not.toBe('2026-09-02')
  expect(screen.queryByRole('region', { name: 'Незбережена чернетка' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Відновити чернетку' })).toBeNull()
  expect(previewStockReport).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Чернетка' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відновити чернетку' }))
  await waitFor(() => expect(dateInput('Від').value).toBe('2026-09-02'))
  expect(screen.queryByRole('dialog', { name: 'Чернетка звіту' })).toBeNull()
  expect(createStockReport).not.toHaveBeenCalled()
})

it('keeps an earlier draft untouched and recoverable across visits that only open the first report', async () => {
  auth.owner = 'repeat-visit-owner'
  const key = reportWorkspaceDraftKey('repeat-visit-owner')
  const first = render(page())
  await findOpenedDayWorkbook()
  expect(sessionStorage.getItem(key)).toBeNull()
  expect((screen.getByRole('button', { name: 'Чернетка' }) as HTMLButtonElement).disabled).toBe(true)
  changeReportPeriod({ from: '2026-09-02' })
  await waitFor(() => expect(sessionStorage.getItem(key)).not.toBeNull())
  const stored = sessionStorage.getItem(key)
  first.unmount()
  for (const visit of [1, 2, 3]) {
    const view = render(page())
    await findOpenedDayWorkbook()
    expect(dateInput('Від').value).not.toBe('2026-09-02')
    expect(sessionStorage.getItem(key)).toBe(stored)
    fireEvent.click(screen.getByRole('button', { name: 'Чернетка' }))
    const dialog = await screen.findByRole('dialog', { name: 'Чернетка звіту' })
    expect(within(dialog).getByText('Налаштування з попереднього відкриття.')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Відкинути чернетку' })).toBeTruthy()
    const restore = within(dialog).getByRole('button', { name: 'Відновити чернетку' }) as HTMLButtonElement
    expect(restore.disabled).toBe(false)
    if (visit < 3) {
      view.unmount()
      continue
    }
    fireEvent.click(restore)
    await waitFor(() => expect(dateInput('Від').value).toBe('2026-09-02'))
  }
  expect(previewStockReport).not.toHaveBeenCalled()
  expect(createStockReport).not.toHaveBeenCalled()
})


it('uses server editable supplier rows, preserves warehouse basis when hidden, and retains the applied result after a layout edit', async () => {
  const configuration = { version: 1, axisMode: 'profitRows', allowedRows: [73, 78, 4, 21], allowedColumns: [], minimumRows: 1, maximumRows: 3, allowRowReorder: true, rowLayouts: [], columnLayouts: [[]], mutuallyExclusiveRows: [[73, 78]], period: { required: true, supported: true, maximumDays: 62, maximumMonths: null, minimumDate: null }, variants: [{ key: 'currentDocuments', allowedRows: [78, 4, 21] }] }
  vi.mocked(getReportDatasets).mockResolvedValue([profitDayDataset, { ...profitSupplierDataset, configuration }])
  render(page())
  const switcher = await findOpenedWorkbook('ВП.xls')
  fireEvent.click(within(switcher).getByRole('button', { name: `Відкрити ${workbookDisplayFileName('ВП по постачальниках.xls')}` }))
  await findOpenedWorkbook('ВП по постачальниках.xls')
  const rows = screen.getByRole('region', { name: 'Групування рядків' })
  const deleteButtons = within(rows).getAllByRole('button', { name: /^Видалити / })
  fireEvent.click(deleteButtons[0])
  await waitFor(() => expect((screen.getByRole('button', { name: 'Застосувати й показати' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
  await screen.findByRole('region', { name: 'Таблиця попереднього перегляду' })
  const request = vi.mocked(previewStockReport).mock.calls.at(-1)![0]
  expect(request).toMatchObject({ dataSource: 38, supplierBasis: 0, supplierWarehouse: 78, profitReadMode: 0 })
  expect(request.sorted.Row.map(row => row.type)).toEqual([4, 21])
  expect(request.sorted.Col).toEqual([])
  fireEvent.click(within(rows).getAllByRole('button', { name: /^Перемістити .* нижче$/ })[0])
  expect(screen.getByRole('region', { name: 'Таблиця попереднього перегляду' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Завантажити Excel' })).toBeTruthy()
})

const resultSession = { ResultId: '11111111-2222-3333-4444-555555555555', RequestSha256: 'b'.repeat(64), ResultSha256: 'a'.repeat(64), ExpiresAtUtc: '2030-01-01T00:00:00Z' }
async function openImmutablePreview() {
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: { DocumentURL: '', PdfDocumentURL: '' }, raw: {} },
    preview: { ...preview, ResultSession: resultSession } })
  await openDayWorkbook()
  fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
  await screen.findByRole('region', { name: 'Таблиця попереднього перегляду' })
}
it.each(['Excel', 'PDF'])('exports the immutable preview through %s, locking both actions while export is pending', async format => {
  let resolve!: (value: Awaited<ReturnType<typeof exportStockReportPreview>>) => void
  vi.mocked(exportStockReportPreview).mockImplementationOnce(() => new Promise(done => { resolve = done }))
  await openImmutablePreview()
  for (const name of ['Excel', 'PDF']) expect(screen.getByRole('button', { name: `Сформувати ${name}` })).toHaveProperty('disabled', false)
  fireEvent.click(screen.getByRole('button', { name: `Сформувати ${format}` }))
  await waitFor(() => expect(exportStockReportPreview).toHaveBeenCalledExactlyOnceWith(resultSession))
  for (const name of ['Excel', 'PDF']) expect(screen.getByRole('button', { name: `Сформувати ${name}` })).toHaveProperty('disabled', true)
  await act(async () => resolve({ document: files, raw: {} }))
  await screen.findByRole('link', { name: 'Завантажити Excel' })
  expect(screen.getByRole('link', { name: 'Завантажити PDF' })).toBeTruthy()
  expect(createStockReport).not.toHaveBeenCalled()
  expect(previewStockReport).toHaveBeenCalledOnce()
})
it('retries a failed export against the same snapshot and keeps a missing PDF disabled after successful partial export', async () => {
  vi.mocked(exportStockReportPreview).mockRejectedValueOnce(new Error('Тимчасова помилка експорту'))
    .mockResolvedValueOnce({ document: { DocumentURL: files.DocumentURL }, raw: {} })
  await openImmutablePreview()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати PDF' }))
  await screen.findByText('Тимчасова помилка експорту')
  expect(screen.getByRole('button', { name: 'Сформувати PDF' })).toHaveProperty('disabled', false)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати PDF' }))
  await screen.findByRole('link', { name: 'Завантажити Excel' })
  expect(vi.mocked(exportStockReportPreview).mock.calls).toEqual([[resultSession], [resultSession]])
  expect(screen.getByRole('button', { name: 'Сформувати PDF' })).toHaveProperty('disabled', true)
  expect(createStockReport).not.toHaveBeenCalled()
  expect(previewStockReport).toHaveBeenCalledOnce()
})


it('offers physical income and outcome in the current workbook Measures section', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, profitDayDataset, profitSupplierDataset,
    movementDataset, cashModeDataset, settlementModeDataset])
  render(page())
  const switcher = await findOpenedWorkbook('ВП.xls')
  fireEvent.click(within(switcher).getByRole('button', { name: `Відкрити ${workbookDisplayFileName('Впарювання.xls')}` }))
  await findOpenedWorkbook('Впарювання.xls')
  const section = screen.getByRole('group', { name: 'Показники' })
  expect((within(section).getByRole('checkbox', { name: 'Прихід' }) as HTMLInputElement).checked).toBe(false)
  fireEvent.click(within(section).getByRole('checkbox', { name: 'Прихід' }))
  fireEvent.click(within(section).getByRole('checkbox', { name: 'Розхід' }))
  expect((within(section).getByRole('checkbox', { name: 'Прихід' }) as HTMLInputElement).checked).toBe(true)
  expect((within(section).getByRole('checkbox', { name: 'Розхід' }) as HTMLInputElement).checked).toBe(true)
  expect(within(section).getByText(/Відбори клієнта та його основного менеджера стосуються лише продажів/)).toBeTruthy()
})

it('does not reset a configured workbook when its active tab is clicked, but explicit Reset still restores defaults', async () => {
  await openDayWorkbook()
  const original = readReportDateInput('Від').value
  changeReportPeriod({ from: '2026-09-02' })
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити ВП.xls' }))
  expect(readReportDateInput('Від').value).toBe('2026-09-02')
  fireEvent.click(screen.getByRole('button', { name: 'Скинути' }))
  await waitFor(() => expect(readReportDateInput('Від').value).toBe(original))
})

it('keeps a newly added blank supplier filter in Filters until its field is selected', async () => {
  await openDayWorkbook()
  fireEvent.click(screen.getByRole('button', { name: `Відкрити ${workbookDisplayFileName('ВП по постачальниках.xls')}` }))
  await findOpenedWorkbook('ВП по постачальниках.xls')
  const filters = screen.getByRole('group', { name: 'Відбори' })
  fireEvent.click(within(filters).getByRole('button', { name: 'Додати умову' }))
  const fields = within(filters).getAllByRole('combobox', { name: 'Поле' })
  expect(fields.at(-1)).toHaveProperty('value', '')
  expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', true)
})
