import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { profitDayDataset, profitSupplierDataset } from '../data/profitReadMode.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true, user: { NetUid: 'profit-mode-owner' } }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, profitDayDataset, profitSupplierDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/current.xlsx' }, raw: {} })
})
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear() })
async function openWorkbook(name: string) {
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByText('Часткові форми за зразками Excel'))
  fireEvent.click(screen.getByRole('button', { name: `Відкрити часткову форму: ${name}` }))
  return view
}
function mode(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Джерело розрахунку' }))
  fireEvent.click(screen.getByRole('option', { name }))
}
it.each(['Валовий прибуток за днем', 'Валовий прибуток за постачальниками'])('keeps original default, then sends deliberate current choice in %s', async name => {
  const view = await openWorkbook(name)
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0].profitReadMode).toBeUndefined()
  mode('Поточні документи GBA')
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
  const current = vi.mocked(createStockReport).mock.calls[1][0]
  expect(current.profitReadMode).toBe(0)
  expect(current.workbookPresentation).toBeUndefined()
  expect(current.dataSource === 35 ? current.dayOrganizationBasis : current.supplierBasis).toBe(0)
  if (current.dataSource === 38) {
    expect(current.supplierSourceWorld).toBeUndefined()
    expect((screen.getByRole('combobox', { name: 'База продажів для прибутку за постачальниками' }) as HTMLInputElement).value).toBe('Усі документи, включно з GBA')
    expect(current.sorted.Row.map(row => row.type)).toEqual([78, 4, 21])
  }
  mode('Збережені регістри 1С')
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(3))
  const original = vi.mocked(createStockReport).mock.calls[2][0]
  expect(original.profitReadMode).toBe(1)
  if (original.dataSource === 38) expect(original.supplierSourceWorld).toBe(0)
  mode('Збережений / автоматичний режим')
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(4))
  expect(Object.hasOwn(vi.mocked(createStockReport).mock.calls[3][0], 'profitReadMode')).toBe(false)
})
it('hides current opt-in without a confirmed capability', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, { ...profitDayDataset, profitReadMode: undefined }])
  await openWorkbook('Валовий прибуток за днем')
  expect(screen.queryByRole('combobox', { name: 'Джерело розрахунку' })).toBeNull()
})
