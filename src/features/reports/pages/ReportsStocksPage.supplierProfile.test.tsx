import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, normalizeSavedTemplate, parseReportDatasets } from '../api/reportWorkspaceApi'
import { supplierProfileDataset } from '../data/salesProfileSupplier.test-fixtures'
import { changeReportPeriod } from '../testing/reportPeriod'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: null, hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue(parseReportDatasets([supplierProfileDataset]))
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null, Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false }, RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [] } })
})
async function open(profile: 'sales' | 'grossProfit') {
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  const tabs = await screen.findByRole('navigation', { name: 'Звіти' })
  await waitFor(() => expect(within(tabs).getByRole('button', { name: 'Відкрити Звіт по продажам' })).toHaveProperty('ariaCurrent', 'true'))
  if (profile === 'grossProfit') fireEvent.click(within(tabs).getByRole('button', { name: 'Відкрити Валовий прибуток' }))
  changeReportPeriod({ from: '2026-10-19', to: '2026-10-27' })
  return view
}
it.each([
  ['sales', 'Row', 'Групування рядків'], ['sales', 'Col', 'Групування стовпців'],
  ['grossProfit', 'Row', 'Групування рядків'], ['grossProfit', 'Col', 'Групування стовпців'],
] as const)('selects advertised supplier in %s/%s dialog and submits stable axis identity', async (profile, axis, label) => {
  const view = await open(profile)
  fireEvent.click(screen.getByRole('button', { name: `Додати поле: ${label}` }))
  fireEvent.change(screen.getByLabelText('Пошук поля'), { target: { value: 'постачальник' } })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Вибрати Постачальник' }))
  fireEvent.click(screen.getByRole('button', { name: 'Додати вибрані (1)' }))
  expect(within(screen.getByRole('region', { name: label })).getByText('Постачальник')).toBeTruthy()
  await act(async () => fireEvent.submit(view.container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  const request = vi.mocked(previewStockReport).mock.calls[0][0]
  expect(request).toMatchObject({ dataSource: 2, reportProfile: profile, from: '2026-10-19', to: '2026-10-27' })
  expect(request.sorted[axis].at(-1)).toMatchObject({ type: 21, label: 'Постачальник' })
  expect(request.sorted.Measurements.map(item => item.Type)).toEqual(profile === 'sales' ? [0, 2, 6, 10, 14] : [2, 6, 10])
})
it('does not offer supplier when the current server has only base groupings', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([{ ...supplierProfileDataset, profileGroupings: undefined }])
  await open('sales')
  fireEvent.click(screen.getByRole('button', { name: 'Додати поле: Групування рядків' }))
  expect(screen.queryByRole('checkbox', { name: 'Вибрати Постачальник' })).toBeNull()
  expect(previewStockReport).not.toHaveBeenCalled()
})

const savedSupplier = (profile: 'sales' | 'grossProfit') => normalizeSavedTemplate({
  Id: 'profile-supplier-template', Revision: 1, UpdatedAtUtc: '2026-10-29T00:00:00Z', Name: 'Постачальники збережені',
  Data: { DataSource: 2, ReportProfile: profile, From: '2026-10-19', To: '2026-10-27', Selections: [],
    Sorted: { Row: [{ type: 21, key: 'Supplier', label: 'Постачальник' }], Col: [],
      Measurements: [{ Type: 6, Name: 'CostWithoutVAT', IsChecked: true, parentName: 'Cost' }, { Type: 2, Name: 'SalesValueWithoutVAT', IsChecked: true, parentName: 'SalesValue' }] } },
})
it.each(['sales', 'grossProfit'] as const)('restores saved %s supplier grouping in the actual page and preserves measure order', async profile => {
  const template = savedSupplier(profile)
  vi.mocked(getServerReportTemplates).mockResolvedValue([template])
  const view = await open('sales')
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Постачальники збережені' }))
  expect(within(screen.getByRole('region', { name: 'Групування рядків' })).getByText('Постачальник')).toBeTruthy()
  await act(async () => fireEvent.submit(view.container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  const request = vi.mocked(previewStockReport).mock.calls[0][0]
  expect(request.reportProfile).toBe(profile)
  expect(request.sorted.Row.map(field => field.type)).toEqual([21])
  expect(request.sorted.Measurements.map(field => field.Type)).toEqual([6, 2])
  expect(template.Data.sorted.Row.map(field => field.type)).toEqual([21])
})
it('refuses applying a saved supplier template on an older server without silently dropping the axis', async () => {
  const template = savedSupplier('sales')
  const before = JSON.stringify(template)
  vi.mocked(getReportDatasets).mockResolvedValue([{ ...supplierProfileDataset, profileGroupings: undefined }])
  vi.mocked(getServerReportTemplates).mockResolvedValue([template])
  await open('sales')
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Постачальники збережені' }))
  expect(await screen.findByText(/Вибране групування не підтримується цим способом розрахунку/)).toBeTruthy()
  expect(previewStockReport).not.toHaveBeenCalled()
  expect(JSON.stringify(template)).toBe(before)
})
