import { currentFinancialDataset } from '../data/currentFinancialAxes.test-fixtures'
import { financialDataset } from '../data/financialAxes.test-fixtures'
import { movementDataset } from '../data/currentVparivanieMovements.test-fixtures'
import { mixedDataset } from '../data/currentVparivanieAnalysis.group-selection.test-fixtures'
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
import { currentVparivanieDataset, currentVparivanieRequest } from '../data/currentVparivanie.test-fixtures'
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

it('restores editable measure checkboxes after switching from movement analysis back to profit workbooks', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, profitDayDataset, profitSupplierDataset,
    mixedDataset, cashModeDataset, settlementModeDataset])
  await openDayWorkbook()
  const measures = () => within(document.getElementById('workbook-settings-pane-measures')!)
  const initial = measures().getAllByRole('checkbox').map(input => input.getAttribute('aria-label'))
  const switcher = screen.getByRole('navigation', { name: 'Звіти' })
  for (const file of ['Впарювання.xls', 'ВП.xls', 'ВП по постачальниках.xls', 'ВП.xls']) {
    fireEvent.click(within(switcher).getByRole('button', { name: `Відкрити ${workbookDisplayFileName(file)}` }))
    await findOpenedWorkbook(file)
    await waitFor(() => expect(screen.queryByText(/застосовуються відбори книги/i)).toBeNull())
    if (file === 'Впарювання.xls') {
      expect(screen.queryByRole('group', { name: 'Показники' })).toBeNull()
      continue
    }
    const inputs = measures().getAllByRole('checkbox')
    if (file === 'ВП.xls') expect(inputs.map(input => input.getAttribute('aria-label'))).toEqual(initial)
    else expect(inputs.length).toBeGreaterThan(0)
  }
})

it('submits newly advertised profit measures from the unified form without losing them on date changes', async () => {
  const marginVat = { Type: 11, Name: 'ПДВ прибутку, EUR' }
  const grossMargin = { Type: 15, Name: 'Рентабельність з ПДВ, %' }
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets,
    { ...profitDayDataset, Measurements: [...profitDayDataset.Measurements, marginVat] },
    { ...profitSupplierDataset, Measurements: [...profitSupplierDataset.Measurements, marginVat, grossMargin] },
    mixedDataset, cashModeDataset, settlementModeDataset])
  await openDayWorkbook()
  for (const [file, source, chosen] of [
    ['ВП.xls', 35, [marginVat]],
    ['ВП по постачальниках.xls', 38, [marginVat, grossMargin]],
  ] as const) {
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Звіти' }))
      .getByRole('button', { name: `Відкрити ${workbookDisplayFileName(file)}` }))
    await findOpenedWorkbook(file)
    await waitFor(() => expect(screen.queryByText(/застосовуються відбори книги/i)).toBeNull())
    const controls = within(document.getElementById('workbook-settings-pane-measures')!)
    fireEvent.click(controls.getByRole('button', { name: 'Очистити' }))
    for (const measure of chosen) fireEvent.click(controls.getByRole('checkbox', { name: measure.Name }))
    changeReportPeriod({ from: dateInput('До').value })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', false))
    vi.mocked(previewStockReport).mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
    await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
    const request = vi.mocked(previewStockReport).mock.calls[0][0]
    expect(request.dataSource).toBe(source)
    expect(request.sorted.Measurements.map(measure => measure.Type)).toEqual(chosen.map(measure => measure.Type))
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
  for (const name of ['Організації', 'Фільтри', 'Показники', 'Групування']) expect(screen.getByRole('group', { name })).toBeTruthy()
  expect((screen.getByRole('checkbox', { name: 'Група «Покупці»' }) as HTMLInputElement).checked).toBe(true)
})

it('keeps settings available without duplicating them in an about section', async () => {
  await openDayWorkbook()
  expect(screen.queryByText('Про звіт')).toBeNull()
  expect(dateInput('Від')).toBeTruthy()
  expect(screen.getByRole('group', { name: 'Організації' })).toBeTruthy()
  expect(screen.getByRole('group', { name: 'Фільтри' })).toBeTruthy()
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
    expect(within(dialog).getByText('Збережено')).toBeTruthy()
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


it('retains physical income and outcome settings when opening an existing custom analysis template', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, profitDayDataset, profitSupplierDataset,
    movementDataset, cashModeDataset, settlementModeDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: 'movement-analysis', Revision: 1,
    Name: 'Аналіз руху', Data: currentVparivanieRequest() }])
  render(page())
  await findOpenedWorkbook('ВП.xls')
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Аналіз руху' }))
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
  const filters = screen.getByRole('group', { name: 'Фільтри' })
  fireEvent.click(within(filters).getByRole('button', { name: 'Додати умову' }))
  const fields = within(filters).getAllByRole('combobox', { name: 'Поле' })
  expect(fields.at(-1)).toHaveProperty('value', '')
  expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', true)
})

it('moves financial dimensions between axes only with server capability and retains them after a date edit', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, financialDataset, profitSupplierDataset,
    currentVparivanieDataset, cashModeDataset, settlementModeDataset])
  await openDayWorkbook()
  fireEvent.click(screen.getByRole('button', { name: 'Перенести Організація до стовпців' }))
  expect(screen.getByText('До 100 організацій у колонках — кожна організація окремим аркушем, більше — одна таблиця.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Перенести Дата до стовпців' })).toHaveProperty('disabled', true)
  changeReportPeriod({ from: dateInput('До').value })
  for (const [row, column] of [[3, 4], [4, 3]]) {
    await waitFor(() => expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', false))
    vi.mocked(previewStockReport).mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
    await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
    const data = vi.mocked(previewStockReport).mock.calls[0][0]
    expect(data.sorted.Row.map(field => field.type)).toEqual([row])
    expect(data.sorted.Col.map(field => field.type)).toEqual([column])
    expect(data.from).toBe(data.to)
    expect(data.profitReadMode).toBe(0)
    if (row === 3) {
      fireEvent.click(screen.getByRole('button', { name: 'Перенести Організація до рядків' }))
      fireEvent.click(screen.getByRole('button', { name: 'Перенести Дата до стовпців' }))
      expect(screen.getByText('До 100 днів у колонках — кожен день окремим аркушем, більше — одна таблиця.')).toBeTruthy()
    }
  }
})


it('transposes client/agreement columns and keeps edited dates and source filters', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, currentFinancialDataset, profitSupplierDataset,
    currentVparivanieDataset, cashModeDataset, settlementModeDataset])
  await openDayWorkbook()
  fireEvent.click(screen.getByRole('button', { name: 'Видалити Дата' }))
  fireEvent.click(screen.getByRole('button', { name: 'Видалити Організація' }))
  for (const [axis, label] of [['рядків', 'Клієнт'], ['стовпців', 'Договір']]) {
    fireEvent.click(screen.getByRole('button', { name: `Додати поле: Групування ${axis}` }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: label }))
  }
  changeReportPeriod({ from: '2026-10-17', to: '2026-10-23' })
  let initial: Parameters<typeof previewStockReport>[0] | undefined
  for (const [row, column] of [[12, 15], [15, 12]]) {
    await waitFor(() => expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', false))
    vi.mocked(previewStockReport).mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
    await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
    const data = vi.mocked(previewStockReport).mock.calls[0][0]
    expect(data.sorted.Row.map(f => f.type)).toEqual([row])
    expect(data.sorted.Col.map(f => f.type)).toEqual([column])
    expect(data).toMatchObject({ from: '2026-10-17', to: '2026-10-23', profitReadMode: 0, dayOrganizationBasis: 0 })
    if (initial) {
      expect(data.selections).toEqual(initial.selections)
      expect(data.sourceOrganizations).toEqual(initial.sourceOrganizations)
      expect(data.sourceBuyerSubtree).toEqual(initial.sourceBuyerSubtree)
    } else {
      initial = structuredClone(data)
      fireEvent.click(screen.getByRole('button', { name: 'Перенести Договір до рядків' }))
      fireEvent.click(screen.getByRole('button', { name: 'Перенести Клієнт до стовпців' }))
      expect(screen.getByText('До 100 клієнтів у колонках — кожен клієнт окремим аркушем, більше — одна таблиця.')).toBeTruthy()
    }
  }
})

it('exports agreement columns in the explicitly chosen workbook layout and leaves automatic to the server', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, currentFinancialDataset, profitSupplierDataset,
    currentVparivanieDataset, cashModeDataset, settlementModeDataset])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: { DocumentURL: '', PdfDocumentURL: '' }, raw: {} },
    preview: { ...preview, ResultSession: resultSession } })
  vi.mocked(exportStockReportPreview).mockResolvedValue({ document: files, raw: {} })
  await openDayWorkbook()
  fireEvent.click(screen.getByRole('button', { name: 'Видалити Дата' }))
  for (const [axis, label] of [['стовпців', 'Договір']]) {
    fireEvent.click(screen.getByRole('button', { name: `Додати поле: Групування ${axis}` }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: label }))
  }
  changeReportPeriod({ from: '2026-10-01', to: '2026-10-31' })
  expect(screen.getByText('До 100 договорів у колонках — кожен договір окремим аркушем, більше — одна таблиця.')).toBeTruthy()
  fireEvent.click(screen.getByRole('radio', { name: 'Одна таблиця' }))
  expect(screen.getByText('У файлі одна таблиця: кожен договір займає свої колонки показників.')).toBeTruthy()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', false))
  fireEvent.click(screen.getByRole('button', { name: 'Застосувати й показати' }))
  await screen.findByRole('region', { name: 'Таблиця попереднього перегляду' })
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати Excel' }))
  await waitFor(() => expect(exportStockReportPreview).toHaveBeenCalledExactlyOnceWith(resultSession, 'table'))
  fireEvent.click(screen.getByRole('radio', { name: 'Окремі аркуші' }))
  expect(screen.getByText('У файлі кожен договір у колонках буде окремим аркушем.')).toBeTruthy()
  fireEvent.click(screen.getByRole('radio', { name: 'Автоматично' }))
  expect(vi.mocked(previewStockReport).mock.calls[0][0].sorted.Col.map(field => field.type)).toEqual([15])
  expect(previewStockReport).toHaveBeenCalledOnce()
})
