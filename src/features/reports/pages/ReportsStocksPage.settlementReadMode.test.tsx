import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { SETTLEMENT_READ_MODE_NOTICE } from '../data/bug1274WorkbookLaunch'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { settlementModeDataset } from '../data/settlementReadMode.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true, user: { NetUid: 'settlement-mode-owner' } }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, settlementModeDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/settlements.xlsx' }, raw: {} })
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
async function submitted(view: ReturnType<typeof render>, count: number) {
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(count))
  return vi.mocked(createStockReport).mock.calls[count - 1][0]
}
it.each([['Взаєморозрахунки за період', [4, 41, 76]], ['Дебіторка за період', [4, 76]]] as const)(
  'keeps the %s launch unopted, then sends a deliberate source choice', async (name, rows) => {
    const view = await openWorkbook(name)
    expect(screen.getAllByText(new RegExp(SETTLEMENT_READ_MODE_NOTICE.slice(0, 40))).length).toBeGreaterThan(0)
    const original = await submitted(view, 1)
    expect(Object.keys(original).some(key => key.toLowerCase() === 'settlementreadmode')).toBe(false)
    mode('Поточні документи GBA')
    expect((screen.getByRole('combobox', { name: 'База взаєморозрахунків' }) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('checkbox', { name: 'Контрагенти у групі «Покупці» (Fenix)' }) as HTMLInputElement).disabled).toBe(true)
    const current = await submitted(view, 2)
    expect(current.settlementReadMode).toBe(0)
    expect(current.groupedSettlementPeriod).toEqual(original.groupedSettlementPeriod)
    expect(current.sourceBuyerSubtree).toEqual(original.sourceBuyerSubtree)
    expect(current.workbookPresentation).toEqual(original.workbookPresentation)
    expect(current.sorted).toEqual(original.sorted)
    expect(current.sorted.Row.map(row => row.type)).toEqual(rows)
    mode('Збережені регістри 1С')
    expect((await submitted(view, 3)).settlementReadMode).toBe(1)
    mode('Збережене налаштування')
    const restored = await submitted(view, 4)
    expect(Object.hasOwn(restored, 'settlementReadMode')).toBe(false)
    expect(restored).toEqual(original)
  })
it('returns an AMG form to Fenix buyers when an explicit source is chosen', async () => {
  const view = await openWorkbook('Дебіторка за період')
  fireEvent.click(screen.getByRole('combobox', { name: 'База взаєморозрахунків' }))
  fireEvent.click(screen.getByRole('option', { name: 'AMG' }))
  mode('Поточні документи GBA')
  const current = await submitted(view, 1)
  expect(current.settlementReadMode).toBe(0)
  expect(current.groupedSettlementPeriod).toEqual({ Version: 1, SourceWorld: 'Fenix', CurrencyBasis: 'SettlementCurrency' })
  expect(current.sourceBuyerSubtree).toMatchObject({ Version: 1, SourceWorld: 'fenix' })
})
it('hides the selector and the notice without a confirmed capability', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, { ...settlementModeDataset, settlementReadMode: undefined }])
  await openWorkbook('Дебіторка за період')
  expect(screen.queryByRole('combobox', { name: 'Джерело розрахунку' })).toBeNull()
  expect(screen.queryByText(new RegExp(SETTLEMENT_READ_MODE_NOTICE.slice(0, 40)))).toBeNull()
})
