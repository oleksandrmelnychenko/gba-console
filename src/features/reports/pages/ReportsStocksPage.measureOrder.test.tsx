import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { grossDataset, netDataset } from '../data/reportDatasets.test-fixtures'
import { changeReportPeriod } from '../testing/reportPeriod'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: null, hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([{ ...netDataset, reportProfiles: ['sales', 'grossProfit'], constructorPresentation: { version: 1, fields: ['negativeRed', 'grandTotals'] }, Groupings: grossDataset.Groupings }])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null, Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false }, RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [] } })
})
afterEach(cleanup)
it('applies alphabetic then manual measure order to preview while retaining period, axes and checked set', async () => {
  const { container } = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  const tabs = await screen.findByRole('navigation', { name: 'Звіти' })
  await waitFor(() => expect(within(tabs).getByRole('button', { name: 'Відкрити Звіт по продажам' })).toHaveProperty('ariaCurrent', 'true'))
  changeReportPeriod({ from: '2026-10-18', to: '2026-10-27' })
  const rowsBefore = screen.getByRole('region', { name: 'Групування рядків' }).textContent
  const columnsBefore = screen.getByRole('region', { name: 'Групування стовпців' }).textContent
  fireEvent.click(screen.getByRole('button', { name: 'Упорядкувати всі показники від А до Я' }))
  expect(previewStockReport).not.toHaveBeenCalled()
  await act(async () => fireEvent.submit(container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  const sorted = vi.mocked(previewStockReport).mock.calls[0][0]
  expect(sorted.sorted.Measurements.map(item => item.Type)).toEqual([0, 10, 2, 14, 6])
  expect(sorted).toMatchObject({ dataSource: 2, reportProfile: 'sales', from: '2026-10-18', to: '2026-10-27', selections: [] })
  fireEvent.click(screen.getByRole('button', { name: 'Перемістити Собівартість вище' }))
  await act(async () => fireEvent.submit(container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledTimes(2))
  const manual = vi.mocked(previewStockReport).mock.calls[1][0]
  expect(manual.sorted.Measurements.map(item => item.Type)).toEqual([0, 10, 2, 6, 14])
  expect(manual.sorted.Row).toEqual(sorted.sorted.Row)
  expect(manual.sorted.Col).toEqual(sorted.sorted.Col)
  expect(manual.selections).toEqual(sorted.selections)
  expect(screen.getByRole('region', { name: 'Групування рядків' }).textContent).toBe(rowsBefore)
  expect(screen.getByRole('region', { name: 'Групування стовпців' }).textContent).toBe(columnsBefore)
})
