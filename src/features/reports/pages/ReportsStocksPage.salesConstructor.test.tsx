import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { grossDataset, netDataset } from '../data/reportDatasets.test-fixtures'
import { customerReturnRequest } from '../data/customerReturnReport'
import { defaultDatasetRequest } from '../data/reportDatasets'
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
it('opens sales and gross-profit profiles, submits one GBA request and preserves the chosen structure when dates change', async () => {
  const { container } = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  const tabs = await screen.findByRole('navigation', { name: 'Звіти' })
  await waitFor(() => expect(within(tabs).getByRole('button', { name: 'Відкрити Звіт по продажам' })).toHaveProperty('ariaCurrent', 'true'))
  changeReportPeriod({ from: '2026-10-01', to: '2026-10-27' })
  await act(async () => fireEvent.submit(container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 2, reportProfile: 'sales' })
  fireEvent.click(within(tabs).getByRole('button', { name: 'Відкрити Валовий прибуток' }))
  const measurements = document.getElementById('workbook-settings-pane-measures')!
  expect(within(measurements).queryByRole('checkbox', { name: /Рентабельність/ })).toBeNull()
  expect(screen.getByRole('button', { name: 'Видалити Група товару' })).toBeTruthy()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Від’ємні значення червоним' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Загальний підсумок' }))
  const rowsBefore = screen.getByRole('region', { name: 'Групування рядків' }).textContent
  changeReportPeriod({ from: '2026-09-01', to: '2026-09-30' })
  expect(screen.getByRole('region', { name: 'Групування рядків' }).textContent).toBe(rowsBefore)
  await act(async () => fireEvent.submit(container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledTimes(2))
  expect(vi.mocked(previewStockReport).mock.calls[1][0]).toMatchObject({ dataSource: 2, reportProfile: 'grossProfit', constructorPresentation: { version: 1, negativeRed: false, grandTotals: false }, from: '2026-09-01', to: '2026-09-30' })
  expect(vi.mocked(previewStockReport).mock.calls[1][0].sorted.Row.map(item => item.type)).toEqual([4, 10, 7])
  expect(vi.mocked(previewStockReport).mock.calls[1][0].sorted.Col.map(item => item.type)).toEqual([2])
})

it('keeps a saved customer-return template filters-only after the workbook marker is cleared', async () => {
  const dataset = { ...netDataset, returnsOnly: true, customerReturnFilters: true,
    Filters: [...netDataset.Filters, { Type: 1, Name: 'Товар' }, { Type: 21, Name: 'Склад' }, { Type: 64, Name: 'Причина' }] }
  const data = customerReturnRequest(defaultDatasetRequest(dataset, '2026-10-01', '2026-10-27'), dataset)
  vi.mocked(getReportDatasets).mockResolvedValue([dataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 1, Name: 'Мої повернення', Data: data }])
  const { container } = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: /Відкрити Звіт повернення/ })
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Мої повернення' }))
  expect(screen.queryByRole('region', { name: 'Групування рядків' })).toBeNull()
  changeReportPeriod({ from: '2026-09-01', to: '2026-09-30' })
  await act(async () => fireEvent.submit(container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 2, returnsOnly: true, from: '2026-09-01' })
})
