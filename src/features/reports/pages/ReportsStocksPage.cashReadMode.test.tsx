import { changeReportPeriod } from '../testing/reportPeriod'
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити Ведомость по денежным средствам.xls' }))
  return view
}
async function submitted(view: ReturnType<typeof render>, count: number) {
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(count))
  return vi.mocked(createStockReport).mock.calls[count - 1][0]
}
const source = () => (screen.getByRole('combobox', { name: 'Джерело розрахунку' }) as HTMLInputElement).value
it('opens the cash workbook on current documents and offers no retired register or opt-out source', async () => {
  const view = await openWorkbook()
  expect(screen.getAllByText('Ведомость по денежным средствам.xls — Відомість по коштах').length).toBeGreaterThan(0)
  expect(source()).toBe('Поточні документи GBA')
  const current = await submitted(view, 1)
  expect(current.cashReadMode).toBe(0)
  expect(current.sorted.Row.map(row => row.type)).toEqual([40])
  fireEvent.click(screen.getByRole('combobox', { name: 'Джерело розрахунку' }))
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Поточні документи GBA'])
  expect(screen.queryByText('Один валютний запис')).toBeNull()
})
it('accepts a period from 01.01.2025 through today by default', async () => {
  const view = await openWorkbook()
  const today = formatKyivBusinessDate()
  changeReportPeriod({ from: '2025-01-01', to: today })
  expect(await submitted(view, 1)).toMatchObject({ cashReadMode: 0, from: '2025-01-01', to: today })
})
it('hides the selector and the notice without a confirmed capability', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, { ...cashModeDataset, cashReadMode: undefined }])
  await openWorkbook()
  expect(screen.queryByRole('combobox', { name: 'Джерело розрахунку' })).toBeNull()
  expect(screen.queryByText(new RegExp(CASH_READ_MODE_NOTICE.slice(0, 40)))).toBeNull()
})
it.each([[0, 'Поточні документи GBA'], [1, 'Збережені регістри 1С']] as const)('does not expose the echoed cash source %s as technical metadata', (echo, label) => {
  const preview = normalizeNativeReportPreview({ Preview: { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true,
    Request: { DataSource: 'NativeCashPeriod', IsCurrentSnapshot: false, HasPeriod: true, CashReadMode: echo },
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
    RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [] } })
  render(<MantineProvider env="test"><I18nProvider><ReportInlinePreview preview={preview} /></I18nProvider></MantineProvider>)
  expect(screen.queryByText(`Джерело розрахунку: ${label}`)).toBeNull()
  expect(screen.getByRole('table')).toBeTruthy()
})
