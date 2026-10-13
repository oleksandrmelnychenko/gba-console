import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { getCashPeriodLegs } from '../api/cashPeriodApi'
import { CASH_READ_MODE_NOTICE } from '../data/bug1274WorkbookLaunch'
import { cashPeriodLeg } from '../data/cashPeriod.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { cashModeDataset } from '../data/cashReadMode.test-fixtures'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { ReportInlinePreview } from './ReportInlinePreview'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true, user: { NetUid: 'cash-mode-owner' } }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
vi.mock('../api/cashPeriodApi', () => ({ getCashPeriodLegs: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, cashModeDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(getCashPeriodLegs).mockResolvedValue([cashPeriodLeg])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/cash.xlsx' }, raw: {} })
})
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear() })
async function openWorkbook() {
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByText('Часткові форми за зразками Excel'))
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити часткову форму: Рух коштів за період' }))
  return view
}
function mode(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Джерело розрахунку' }))
  fireEvent.click(screen.getByRole('option', { name }))
}
async function submitted(view: ReturnType<typeof render>, count: number) {
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(count))
  return vi.mocked(createStockReport).mock.calls[count - 1][0]
}
it('keeps the cash workbook launch unopted, then sends a deliberate source choice', async () => {
  const view = await openWorkbook()
  expect(screen.getAllByText(new RegExp(CASH_READ_MODE_NOTICE.slice(0, 40))).length).toBeGreaterThan(0)
  const original = await submitted(view, 1)
  expect(Object.keys(original).some(key => key.toLowerCase() === 'cashreadmode')).toBe(false)
  mode('Поточні документи GBA')
  const current = await submitted(view, 2)
  expect(current.cashReadMode).toBe(0)
  expect(current.groupedCashPeriod).toEqual(original.groupedCashPeriod)
  expect(current.workbookPresentation).toEqual(original.workbookPresentation)
  expect(current.sorted).toEqual(original.sorted)
  expect(current.sorted.Row.map(row => row.type)).toEqual([40])
  mode('Збережені регістри 1С')
  expect((await submitted(view, 3)).cashReadMode).toBe(1)
  mode('Збережене налаштування')
  const restored = await submitted(view, 4)
  expect(Object.hasOwn(restored, 'cashReadMode')).toBe(false)
  expect(restored).toEqual(original)
}, 15_000)
it('accepts a period from 01.01.2025 through today only with an explicit source', async () => {
  const view = await openWorkbook()
  const today = formatKyivBusinessDate()
  fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2025-01-01' } })
  fireEvent.change(screen.getByLabelText('До'), { target: { value: today } })
  fireEvent.submit(view.container.querySelector('form')!)
  expect(createStockReport).not.toHaveBeenCalled()
  mode('Поточні документи GBA')
  expect(await submitted(view, 1)).toMatchObject({ cashReadMode: 0, from: '2025-01-01', to: today })
}, 15_000)
it('clears the source when switching to one exact account', async () => {
  const view = await openWorkbook()
  mode('Поточні документи GBA')
  fireEvent.click(screen.getByLabelText('Один валютний запис'))
  expect(screen.queryByRole('combobox', { name: 'Джерело розрахунку' })).toBeNull()
  fireEvent.click(await screen.findByRole('combobox', { name: 'Рахунок і власна валюта' }))
  fireEvent.click(await screen.findByRole('option', { name: /Synthetic organization/ }))
  const exact = await submitted(view, 1)
  expect(exact.groupedCashPeriod).toBeUndefined()
  expect(Object.keys(exact).some(key => key.toLowerCase() === 'cashreadmode')).toBe(false)
  fireEvent.click(screen.getByLabelText('Усі / вибрані рахунки'))
  expect((screen.getByRole('combobox', { name: 'Джерело розрахунку' }) as HTMLInputElement).value).toBe('Збережене налаштування')
})
it('hides the selector and the notice without a confirmed capability', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, { ...cashModeDataset, cashReadMode: undefined }])
  await openWorkbook()
  expect(screen.queryByRole('combobox', { name: 'Джерело розрахунку' })).toBeNull()
  expect(screen.queryByText(new RegExp(CASH_READ_MODE_NOTICE.slice(0, 40)))).toBeNull()
})
it.each([[0, 'Поточні документи GBA'], [1, 'Збережені регістри 1С']] as const)('shows the echoed cash source %s in the report description', (echo, label) => {
  const preview = normalizeNativeReportPreview({ Preview: { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
    Request: { DataSource: 'NativeCashPeriod', IsCurrentSnapshot: false, HasPeriod: true, CashReadMode: echo },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
    RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [] } })
  render(<MantineProvider env="test"><ReportInlinePreview preview={preview} /></MantineProvider>)
  expect(within(screen.getByRole('region', { name: 'Про дані звіту' })).getByText(`Джерело розрахунку: ${label}`)).toBeTruthy()
})
