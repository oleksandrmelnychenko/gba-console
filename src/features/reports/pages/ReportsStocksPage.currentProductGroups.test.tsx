import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { productGroupsCapability, productGroupsPreview, productGroupsRequest } from '../data/currentProductGroups.test-fixtures'
import { detailDataset, detailGrouping } from '../data/reportDocumentDetails.test-fixtures'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { changeReportPeriod } from '../testing/reportPeriod'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: null, hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
const dataset = { ...detailDataset, currentProductGroupLists: productGroupsCapability }
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([dataset]); vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: normalizeNativeReportPreview({ Preview: productGroupsPreview() }) })
})
afterEach(cleanup)
async function ready() {
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  const tabs = await screen.findByRole('navigation', { name: 'Звіти' })
  await waitFor(() => expect(within(tabs).getByRole('button', { name: 'Відкрити Звіт по продажам' })).toHaveProperty('ariaCurrent', 'true'))
  fireEvent.click(screen.getByText('Додатково', { exact: true }))
  return view
}
it('keeps ordered fields and deepest detail across date edits and blocks a missing product row without clearing groups', async () => {
  const view = await ready()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Детальні записи' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Розмір (поточний товар)' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Групи (поточний товар)' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Артикул (поточний товар)' }))
  fireEvent.click(screen.getByRole('button', { name: 'Перемістити поле Групи (поточний товар) вище' }))
  changeReportPeriod({ from: '2026-10-18', to: '2026-10-27' })
  await act(async () => fireEvent.submit(view.container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  const request = vi.mocked(previewStockReport).mock.calls[0][0]
  expect(request).toMatchObject({ from: '2026-10-18', to: '2026-10-27', reportProfile: 'sales', workbookPresentation: { version: 3, additionalFields: [67, 66, 2], ordering: null } })
  expect(request.sorted.Row.map(row => row.type)).toEqual([4, 7, 84])
  fireEvent.click(screen.getByRole('button', { name: 'Видалити Назва товару' }))
  expect(screen.getAllByText(/Додайте «Товар» або «Назва товару»/).length).toBeGreaterThan(0)
  expect(screen.getByRole('checkbox', { name: 'Групи (поточний товар)' })).toHaveProperty('checked', true)
  expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', true)
})
it.each([2, 3])('restores version%i saved fields with the same bytes and period independent of current capability', async version => {
  const saved = productGroupsRequest(); saved.reportProfile = 'grossProfit'; saved.sorted.Row.push(detailGrouping)
  delete (saved as { workbookPresentation?: unknown }).workbookPresentation
  const selection = { Version: version, AdditionalFields: version === 3 ? [67, 66, 2] : [66, 2], Ordering: null }
  const template = normalizeSavedTemplate({ Id: 'group-template', Revision: 1, Name: 'Групи з деталями', UpdatedAtUtc: '2026-10-29T00:00:00Z', Data: { DataSource: saved.dataSource, ReportProfile: saved.reportProfile, From: saved.from, To: saved.to, Sorted: saved.sorted, Selections: saved.selections, WorkbookPresentation: selection } })
  vi.mocked(getServerReportTemplates).mockResolvedValue([template])
  const view = await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Групи з деталями' }))
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Розмір (поточний товар)' })).toHaveProperty('checked', true))
  expect(screen.getByRole('checkbox', { name: 'Групи (поточний товар)' })).toHaveProperty('checked', version === 3)
  changeReportPeriod({ from: '2026-09-01', to: '2026-09-30' })
  await act(async () => fireEvent.submit(view.container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({ reportProfile: 'grossProfit', from: '2026-09-01', workbookPresentation: selection })
})
it('does not offer groups on the old v2 server', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([detailDataset])
  await ready()
  expect(screen.queryByRole('checkbox', { name: 'Групи (поточний товар)' })).toBeNull()
  expect(screen.getByRole('checkbox', { name: 'Артикул (поточний товар)' })).toBeTruthy()
})
