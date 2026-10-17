import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { getSettlementCounterpartyGroups } from '../api/counterpartyGroupsApi'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { profitDayDataset, profitSupplierDataset } from '../data/profitReadMode.test-fixtures'
import { cashModeDataset } from '../data/cashReadMode.test-fixtures'
import { settlementModeDataset } from '../data/settlementReadMode.test-fixtures'
import { groupCapability } from '../data/sourceCounterpartyGroups.test-fixtures'
import { SAVED_VARIANT_WITHOUT_READ_MODE_ERROR, TEMPLATE_WITHOUT_READ_MODE_ERROR } from '../data/currentReadModePolicy'
import { settlementPeriodRequest } from '../data/settlementPeriod.test-fixtures'
import type { ReportDataset, ReportRequestBody } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../reportSurfacePolicy', () => ({ BUG_1274_ONLY_REPORT_SURFACE: true }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: () => null }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/counterpartyGroupsApi', () => ({ getSettlementCounterpartyGroups: vi.fn() }))

const settlementGroupsDataset: ReportDataset = { ...settlementModeDataset, sourceCounterpartyGroups: groupCapability }
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, profitDayDataset, profitSupplierDataset, cashModeDataset, settlementGroupsDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(getSettlementCounterpartyGroups).mockResolvedValue([])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/current.xlsx' }, raw: {} })
})
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear() })

const page = () => <MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>
async function openWorkbook(label: string) {
  const view = render(page())
  fireEvent.click(await screen.findByText('Часткові форми за зразками Excel'))
  fireEvent.click(screen.getByRole('button', { name: `Відкрити часткову форму: ${label}` }))
  return view
}
async function submitted(view: ReturnType<typeof render>, count = 1) {
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(count))
  return vi.mocked(createStockReport).mock.calls[count - 1][0]
}
function template(name: string, data: ReportRequestBody) {
  return { Id: crypto.randomUUID(), Revision: 1, Name: name, Data: data }
}
function modeless(dataset: ReportDataset, extra: Partial<ReportRequestBody> = {}): ReportRequestBody {
  const data = defaultDatasetRequest(dataset, '2026-09-01', '2026-09-30')
  delete data.profitReadMode
  delete data.cashReadMode
  delete data.settlementReadMode
  return { ...data, ...extra }
}

it('opens «Взаємороз всі.xls» on current documents with the workbook exclusions and no legacy scope controls', async () => {
  const view = await openWorkbook('Взаєморозрахунки за період')
  expect(screen.queryByRole('combobox', { name: 'Обсяг взаєморозрахунків' })).toBeNull()
  const world = screen.getByRole('combobox', { name: 'База взаєморозрахунків' }) as HTMLInputElement
  expect(world.value).toBe('Fenix')
  expect(world.disabled).toBe(true)
  for (const name of ['Харків Скляр', 'Ніжин - ФОП Гречківська О.І.', 'НЕВІДОМІ']) expect(screen.getAllByText(name).length).toBeGreaterThan(0)
  const request = await submitted(view)
  expect(request).toMatchObject({ dataSource: 41, settlementReadMode: 0,
    sourceCounterpartyGroups: { Version: 1, SourceWorld: 'fenix', IncludeGroupIds: [],
      ExcludeGroupIds: ['A156005056C0000811E182DA08AE7D43', 'B1A7005056C0000811E18EBBAA67CF52', '8AB2005056C0000811DEFEBB3581EBEC'] } })
})

it('hides the single currency record of the cash form', async () => {
  const view = await openWorkbook('Рух коштів за період')
  expect(screen.queryByText('Один валютний запис')).toBeNull()
  expect((await submitted(view)).cashReadMode).toBe(0)
})

it('keeps the day form on current documents after a reset', async () => {
  const view = await openWorkbook('Валовий прибуток за днем')
  fireEvent.click(screen.getByRole('button', { name: 'Скинути' }))
  expect((screen.getByRole('combobox', { name: 'Джерело розрахунку' }) as HTMLInputElement).value).toBe('Поточні документи GBA')
  expect(await submitted(view)).toMatchObject({ dataSource: 35, profitReadMode: 0, dayOrganizationBasis: 0 })
})

it('applies a compatible template without a mode on current documents and refuses an incompatible one', async () => {
  const compatible = template('Сумісний шаблон', modeless(settlementGroupsDataset))
  const exact = template('Точний договір', { ...settlementPeriodRequest(), from: '2026-09-01', to: '2026-09-30' })
  vi.mocked(getServerReportTemplates).mockResolvedValue([compatible, exact])
  const view = render(page())
  fireEvent.click(await screen.findByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: `Відкрити для редагування: ${exact.Name}` }))
  expect(await screen.findByText(TEMPLATE_WITHOUT_READ_MODE_ERROR)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: `Відкрити для редагування: ${compatible.Name}` }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Джерело розрахунку' }) as HTMLInputElement).value).toBe('Поточні документи GBA'))
  expect((await submitted(view)).settlementReadMode).toBe(0)
})

it('refuses a saved variant without a mode instead of posting its legacy body', async () => {
  const stored = template('Старий варіант', modeless(cashModeDataset))
  vi.mocked(getServerReportTemplates).mockResolvedValue([stored])
  render(page())
  fireEvent.click(await screen.findByRole('button', { name: 'Шаблони' }))
  fireEvent.click(within(await screen.findByRole('group', { name: stored.Name })).getByRole('button', { name: 'Збережений варіант' }))
  expect(await screen.findByText(SAVED_VARIANT_WITHOUT_READ_MODE_ERROR)).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Показати збережений варіант' }) as HTMLButtonElement).disabled).toBe(true)
})
