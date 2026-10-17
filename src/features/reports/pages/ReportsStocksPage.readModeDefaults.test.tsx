import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { profitSupplierDataset } from '../data/profitReadMode.test-fixtures'
import { cashModeDataset } from '../data/cashReadMode.test-fixtures'
import { settlementModeDataset } from '../data/settlementReadMode.test-fixtures'
import type { ReportDataset, ReportRequestBody } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: () => null }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, profitSupplierDataset, cashModeDataset, settlementModeDataset])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/saved.xlsx' }, raw: {} })
})
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear() })
function saved(dataset: ReportDataset, from: string, to: string, extra: Partial<ReportRequestBody> = {}) {
  const data = defaultDatasetRequest(dataset, from, to)
  delete data.profitReadMode
  delete data.cashReadMode
  delete data.settlementReadMode
  return { Id: crypto.randomUUID(), Revision: 1, Name: 'Saved source variant', Data: { ...data, ...extra } }
}
async function apply(template: ReturnType<typeof saved>) {
  vi.mocked(getServerReportTemplates).mockResolvedValue([template])
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: /Saved source variant/ }))
  return view
}
const source = () => (screen.getByRole('combobox', { name: 'Джерело розрахунку' }) as HTMLInputElement).value
function mode(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Джерело розрахунку' }))
  fireEvent.click(screen.getByRole('option', { name }))
}
async function submitted(view: ReturnType<typeof render>, count: number) {
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(count))
  return vi.mocked(createStockReport).mock.calls[count - 1][0]
}
function blocked(view: ReturnType<typeof render>) {
  fireEvent.submit(view.container.querySelector('form')!)
  expect(createStockReport).not.toHaveBeenCalled()
  return view.container.querySelector('.reports-stocks-generate')?.getAttribute('title')
}

it('reads a saved profit variant without a mode from current documents and reports the current-document period limit', async () => {
  const view = await apply(saved(profitSupplierDataset, '2026-07-01', '2026-08-31', { supplierSourceWorld: 0 }))
  expect(source()).toBe('Поточні документи GBA')
  expect(blocked(view)).toBe('Період «Валового прибутку по постачальниках» — не більше 31 календарних днів. Зменште період.')
  mode('Збережені регістри 1С')
  expect(await submitted(view, 1)).toMatchObject({ profitReadMode: 1, supplierSourceWorld: 0, from: '2026-07-01', to: '2026-08-31' })
})

it('keeps the saved registers choice of a profit variant', async () => {
  const view = await apply(saved(profitSupplierDataset, '2026-07-01', '2026-08-31', { supplierSourceWorld: 0, ProfitReadMode: 1 }))
  expect(source()).toBe('Збережені регістри 1С')
  expect((await submitted(view, 1)).profitReadMode).toBe(1)
})

it('reads a saved cash variant without a mode from current documents and leaves the earlier period to the opt-out', async () => {
  const view = await apply(saved(cashModeDataset, '2024-12-01', '2024-12-31'))
  expect(source()).toBe('Поточні документи GBA')
  expect(blocked(view)).toBe('Оберіть коректний період від 01.01.2025 до 120 календарних місяців.')
  mode('За налаштуваннями звіту')
  const unmarked = await submitted(view, 1)
  expect(Object.keys(unmarked).some(key => key.toLowerCase() === 'cashreadmode')).toBe(false)
  expect(unmarked).toMatchObject({ from: '2024-12-01', to: '2024-12-31' })
})

it.each([[undefined, 0, 'Поточні документи GBA'], [1, 1, 'Збережені регістри 1С']] as const)(
  'opens a saved settlement variant with mode %s as %s', async (stored, sent, label) => {
    const view = await apply(saved(settlementModeDataset, '2025-01-01', '2026-09-30', stored === undefined ? {} : { SettlementReadMode: stored }))
    expect(source()).toBe(label)
    const request = await submitted(view, 1)
    expect(Object.keys(request).filter(key => key.toLowerCase() === 'settlementreadmode')
      .map(key => (request as unknown as Record<string, unknown>)[key])).toEqual([sent])
  })
