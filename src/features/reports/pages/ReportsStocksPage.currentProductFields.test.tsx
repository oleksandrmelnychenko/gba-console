import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { productDataset, productPreview, productRequest } from '../data/currentProductFields.test-fixtures'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { changeReportPeriod } from '../testing/reportPeriod'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: null, hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([productDataset]); vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: normalizeNativeReportPreview({ Preview: productPreview() }) })
})
afterEach(cleanup)
async function ready() {
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  const tabs = await screen.findByRole('navigation', { name: 'Звіти' })
  await waitFor(() => expect(within(tabs).getByRole('button', { name: 'Відкрити Звіт по продажам' })).toHaveProperty('ariaCurrent', 'true'))
  fireEvent.click(screen.getByText('Додатково', { exact: true }))
  return view
}
it('retains field order and all settings across dates and refuses a removed product row without clearing saved selection', async () => {
  const { container } = await ready()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Розмір (поточний товар)' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Артикул (поточний товар)' }))
  changeReportPeriod({ from: '2026-10-18', to: '2026-10-27' })
  await act(async () => fireEvent.submit(container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  const request = vi.mocked(previewStockReport).mock.calls[0][0]
  expect(request.workbookPresentation).toEqual({ version: 2, additionalFields: [66, 2], ordering: null })
  expect(request).toMatchObject({ from: '2026-10-18', to: '2026-10-27', reportProfile: 'sales' })
  fireEvent.click(screen.getByRole('button', { name: 'Видалити Назва товару' }))
  expect(screen.getAllByText(/Додайте «Товар» або «Назва товару»/).length).toBeGreaterThan(0)
  expect(screen.getByRole('checkbox', { name: 'Розмір (поточний товар)' })).toHaveProperty('checked', true)
  expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', true)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Розмір (поточний товар)' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Артикул (поточний товар)' }))
  expect(screen.queryByRole('button', { name: 'Прибрати поточні поля товару' })).toBeNull()
})
it('restores an actual saved profile template and keeps field selection when period changes', async () => {
  const saved = productRequest('grossProfit'); delete saved.workbookPresentation
  saved.WorkbookPresentation = { Version: 2, AdditionalFields: [66, 2], Ordering: null }
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 1, Name: 'Поточні реквізити', Data: saved }])
  const { container } = await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Поточні реквізити' }))
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Розмір (поточний товар)' })).toHaveProperty('checked', true))
  changeReportPeriod({ from: '2026-09-01', to: '2026-09-30' })
  await act(async () => fireEvent.submit(container.querySelector('form')!))
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({ reportProfile: 'grossProfit', from: '2026-09-01',
    workbookPresentation: { Version: 2, AdditionalFields: [66, 2], Ordering: null } })
})
