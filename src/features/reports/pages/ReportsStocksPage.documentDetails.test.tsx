import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { detailDataset, detailRequest } from '../data/reportDocumentDetails.test-fixtures'
import { productPreview } from '../data/currentProductFields.test-fixtures'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { changeReportPeriod } from '../testing/reportPeriod'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: null, hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([detailDataset]); vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: normalizeNativeReportPreview({ Preview: productPreview() }) })
})
afterEach(cleanup)
async function open(profile: 'sales' | 'grossProfit' = 'sales') {
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  const tabs = await screen.findByRole('navigation', { name: 'Звіти' })
  await waitFor(() => expect(within(tabs).getByRole('button', { name: 'Відкрити Звіт по продажам' })).toHaveProperty('ariaCurrent', 'true'))
  if (profile === 'grossProfit') fireEvent.click(within(tabs).getByRole('button', { name: 'Відкрити Валовий прибуток' }))
  return view
}
it.each(['sales', 'grossProfit'] as const)('adds a locked deepest detail row in %s, retains current fields and dates, and removes only detail', async profile => {
  const view = await open(profile)
  const organization = screen.queryByRole('button', { name: 'Видалити Організація' }); if (organization) fireEvent.click(organization)
  const productGroup = screen.queryByRole('button', { name: 'Видалити Група товару' }); if (productGroup) fireEvent.click(productGroup)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Детальні записи' }))
  expect(screen.getByRole('button', { name: 'Перемістити Детальний запис GBA вище' })).toHaveProperty('disabled', true)
  expect(screen.queryByRole('button', { name: 'Видалити Детальний запис GBA' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Додати поле: Групування рядків' }))
  expect(screen.queryByRole('checkbox', { name: 'Вибрати Детальний запис GBA' })).toBeNull()
  fireEvent.change(screen.getByLabelText('Пошук поля'), { target: { value: 'постачальник' } })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Вибрати Постачальник' }))
  fireEvent.click(screen.getByRole('button', { name: 'Додати вибрані (1)' }))
  fireEvent.click(screen.getByText('Додатково', { exact: true }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Розмір (поточний товар)' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Артикул (поточний товар)' }))
  changeReportPeriod({ from: '2026-10-18', to: '2026-10-27' })
  await act(async () => fireEvent.submit(view.container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  const request = vi.mocked(previewStockReport).mock.calls[0][0]
  expect(request).toMatchObject({ reportProfile: profile, from: '2026-10-18', to: '2026-10-27', workbookPresentation: { version: 2, additionalFields: [66, 2], ordering: null } })
  expect(request.sorted.Row.map(row => row.type)).toEqual([7, 21, 84])
  fireEvent.click(screen.getByRole('checkbox', { name: 'Детальні записи' }))
  await act(async () => fireEvent.submit(view.container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledTimes(2))
  expect(vi.mocked(previewStockReport).mock.calls[1][0].sorted.Row.map(row => row.type)).toEqual([7, 21])
})
it('restores saved detail identity and keeps it across a period change', async () => {
  const request = detailRequest('grossProfit')
  const template = normalizeSavedTemplate({ Id: 'detail-template', Revision: 1, UpdatedAtUtc: '2026-10-29T00:00:00Z', Name: 'Документи з полями', Data: {
    DataSource: 2, ReportProfile: 'grossProfit', From: request.from, To: request.to, Sorted: request.sorted, Selections: [], WorkbookPresentation: request.workbookPresentation } })
  vi.mocked(getServerReportTemplates).mockResolvedValue([template])
  const view = await open()
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Документи з полями' }))
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Детальні записи' })).toHaveProperty('checked', true))
  changeReportPeriod({ from: '2026-09-01', to: '2026-09-30' })
  await act(async () => fireEvent.submit(view.container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({ reportProfile: 'grossProfit', from: '2026-09-01', workbookPresentation: request.workbookPresentation })
  expect(vi.mocked(previewStockReport).mock.calls[0][0].sorted.Row.map(row => row.type)).toEqual([7, 84])
})
it('does not offer details on an older server', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([{ ...detailDataset, documentDetails: undefined }])
  await open()
  expect(screen.queryByRole('checkbox', { name: 'Детальні записи' })).toBeNull()
})
