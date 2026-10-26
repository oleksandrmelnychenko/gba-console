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
import { WORKBOOK_FILES } from '../testing/workbookFiles'
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
  fireEvent.click(screen.getByRole('button', { name: `Відкрити ${WORKBOOK_FILES[name] ?? name}` }))
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
const source = () => (screen.getByRole('combobox', { name: 'Джерело розрахунку' }) as HTMLInputElement).value
const world = () => screen.queryByRole('combobox', { name: 'База взаєморозрахунків' })
it.each([['Взаєморозрахунки за період', [4, 41, 76]], ['Дебіторка за період', [4, 76]]] as const)(
  'opens %s on current documents, then keeps deliberate registers and opt-out choices', async (name, rows) => {
    const view = await openWorkbook(name)
    expect(screen.getAllByText(/^(Взаємороз всі|ДБіторка)\.xls — /).length).toBeGreaterThan(0)
    expect(source()).toBe('Поточні документи GBA')
    expect(world()).toBeNull()
    expect((screen.getByRole('checkbox', { name: 'Контрагенти у групі «Покупці» (Fenix)' }) as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByText(/Період — до 31 дня/)).toBeNull()
    const current = await submitted(view, 1)
    expect(current.settlementReadMode).toBe(0)
    expect(current.groupedSettlementPeriod).toEqual({ Version: 1, SourceWorld: 'Fenix', CurrencyBasis: 'SettlementCurrency' })
    expect(current.sourceBuyerSubtree).toMatchObject({ Version: 1, SourceWorld: 'fenix' })
    expect(current.sorted.Row.map(row => row.type)).toEqual(rows)
    mode('Збережені регістри 1С')
    expect(await submitted(view, 2)).toEqual({ ...current, settlementReadMode: 1 })
    mode('За налаштуваннями звіту')
    expect(world()).toBeNull()
    expect(screen.getByText(/^Джерело не передається: звіт визначає його за налаштуваннями/)).toBeTruthy()
    const unmarked = await submitted(view, 3)
    expect(Object.keys(unmarked).some(key => key.toLowerCase() === 'settlementreadmode')).toBe(false)
    const { settlementReadMode: _mode, ...rest } = current
    void _mode
    expect(unmarked).toEqual(rest)
  })
it('offers no AMG base through the opt-out and keeps the Fenix-shaped unified request', async () => {
  const view = await openWorkbook('Дебіторка за період')
  mode('За налаштуваннями звіту')
  expect(world()).toBeNull()
  mode('Поточні документи GBA')
  const current = await submitted(view, 1)
  expect(current.settlementReadMode).toBe(0)
  expect(current.groupedSettlementPeriod).toEqual({ Version: 1, SourceWorld: 'Fenix', CurrencyBasis: 'SettlementCurrency' })
  expect(current.sourceBuyerSubtree).toMatchObject({ Version: 1, SourceWorld: 'fenix' })
})
it('restores current documents when the form returns from one agreement to all buyers', async () => {
  await openWorkbook('Взаєморозрахунки за період')
  mode('Збережені регістри 1С')
  const scope = () => screen.getByRole('combobox', { name: 'Обсяг взаєморозрахунків' })
  fireEvent.click(scope())
  fireEvent.click(screen.getByRole('option', { name: 'Один точний договір' }))
  expect(screen.queryByRole('combobox', { name: 'Джерело розрахунку' })).toBeNull()
  fireEvent.click(scope())
  fireEvent.click(screen.getByRole('option', { name: /^Поточні договори/ }))
  expect(source()).toBe('Поточні документи GBA')
})
it('hides the selector and the notice without a confirmed capability', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, { ...settlementModeDataset, settlementReadMode: undefined }])
  await openWorkbook('Дебіторка за період')
  expect(screen.queryByRole('combobox', { name: 'Джерело розрахунку' })).toBeNull()
  expect(screen.queryByText(new RegExp(SETTLEMENT_READ_MODE_NOTICE.slice(0, 40)))).toBeNull()
})
