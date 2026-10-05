import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { presentedSettlementDataset } from '../data/workbookPresentation.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'
const auth = vi.hoisted(() => ({ enabled: true, owner: 'owner-A' }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => auth.enabled, user: { NetUid: auth.owner } }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
beforeEach(() => {
  auth.enabled = true; auth.owner = 'owner-A'; vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, presentedSettlementDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/current.xlsx' }, raw: {} })
})
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear() })
const page = () => <MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>
async function debtor() {
  const view = render(page()); await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByText('Часткові форми за зразками Excel'))
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити часткову форму: Дебіторка за період' }))
  return view
}
it('submits debtor Currency only, then invalidates prior file links when a display field changes', async () => {
  const view = await debtor()
  fireEvent.submit(view.container.querySelector('form')!)
  await screen.findByRole('dialog')
  expect(vi.mocked(createStockReport).mock.calls[0][0].workbookPresentation).toEqual({ version: 1, additionalFields: [30], ordering: null })
  expect(vi.mocked(createStockReport).mock.calls[0][0].sorted.Row.map(row => row.type)).toEqual([4, 76])
  fireEvent.click(screen.getByRole('checkbox', { name: 'Основний менеджер покупця' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
  expect(vi.mocked(createStockReport).mock.calls[1][0].workbookPresentation).toEqual({ version: 1, additionalFields: [30, 60], ordering: null })
})
it('keeps a deferred old workbook unavailable after caller changes even if the original response arrives', async () => {
  let complete!: (value: Awaited<ReturnType<typeof createStockReport>>) => void
  vi.mocked(createStockReport).mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
  const view = await debtor(); fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  auth.owner = 'owner-B'; view.rerender(page())
  await act(async () => { complete({ document: { DocumentURL: '/files/old-caller.xlsx' }, raw: {} }) })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(view.container.querySelector('a[href="/files/old-caller.xlsx"]')).toBeNull()
})
it('preserves selected Fenix manager on an AMG switch while refusing submission until explicitly cleared', async () => {
  const view = await debtor()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Основний менеджер покупця' }))
  fireEvent.click(screen.getByRole('combobox', { name: 'База взаєморозрахунків' }))
  fireEvent.click(screen.getByRole('option', { name: 'AMG' }))
  expect((screen.getByRole('checkbox', { name: 'Основний менеджер покупця' }) as HTMLInputElement).checked).toBe(true)
  fireEvent.submit(view.container.querySelector('form')!); expect(createStockReport).not.toHaveBeenCalled()
  expect(screen.getByText(/Збережені налаштування не змінено/)).toBeTruthy()
})
