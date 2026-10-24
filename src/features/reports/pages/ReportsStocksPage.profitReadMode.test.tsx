import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { profitDayDataset, profitSupplierDataset } from '../data/profitReadMode.test-fixtures'
import { DAY_ORGANIZATION_GOODS_KIND_ID, DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS } from '../data/dayOrganizationGrossProfit'
import { FENIX_BUYERS_ROOT_ID } from '../data/nativeExactFilters'
import { ReportsStocksPage } from './ReportsStocksPage'
import { WORKBOOK_FILES } from '../testing/workbookFiles'
import { currentFinancialDataset } from '../data/currentFinancialAxes.test-fixtures'
import { changeReportPeriod } from '../testing/reportPeriod'
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
  fireEvent.click(screen.getByRole('button', { name: `Відкрити ${WORKBOOK_FILES[name] ?? name}` }))
  await waitFor(() => expect(screen.queryByText(/застосовуються відбори книги/i)).toBeNull())
  return view
}
function mode(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Джерело розрахунку' }))
  fireEvent.click(screen.getByRole('option', { name }))
}
const source = () => (screen.getByRole('combobox', { name: 'Джерело розрахунку' }) as HTMLInputElement).value
async function submitted(view: ReturnType<typeof render>, count: number) {
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(count))
  return vi.mocked(createStockReport).mock.calls[count - 1][0]
}
it.each(['Валовий прибуток за днем', 'Валовий прибуток за постачальниками'])('opens %s on current documents, then keeps deliberate registers and opt-out choices', async name => {
  const view = await openWorkbook(name)
  expect(source()).toBe('Поточні документи GBA')
  expect(screen.getByText(/Продажі та повернення з документів GBA за період до 31 календарних днів, звірені з 1С/)).toBeTruthy()
  const current = await submitted(view, 1)
  expect(current.profitReadMode).toBe(0)
  expect(current.dataSource === 35 ? current.dayOrganizationBasis : current.supplierBasis).toBe(0)
  if (current.dataSource === 35) {
    expect(current).toMatchObject({ productClassification: { ProductKindId: DAY_ORGANIZATION_GOODS_KIND_ID, IsService: false },
      sourceOrganizations: { OrganizationIds: [...DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS] }, sourceBuyerSubtree: { BuyerRootId: FENIX_BUYERS_ROOT_ID },
      workbookPresentation: { version: 1, additionalFields: [2, 3], ordering: 'MonthAscending' } })
    for (const label of ['Товар без послуг (Fenix)', 'Організації зі збереженого налаштування 1С', 'Група «Покупці» Fenix'])
      expect((screen.getByRole('checkbox', { name: label }) as HTMLInputElement).checked).toBe(true)
  } else {
    expect(current.workbookPresentation).toBeUndefined()
    expect(current.supplierSourceWorld).toBeUndefined()
    expect((screen.getByRole('combobox', { name: 'База продажів для прибутку за постачальниками' }) as HTMLInputElement).value).toBe('Усі документи, включно з GBA')
    expect(current.sorted.Row.map(row => row.type)).toEqual([78, 4, 21])
  }
  mode('Збережені регістри 1С')
  expect(screen.queryByRole('dialog')).toBeNull()
  const original = await submitted(view, 2)
  expect(original.profitReadMode).toBe(1)
  if (original.dataSource === 38) expect(original.supplierSourceWorld).toBe(0)
  mode('За налаштуваннями звіту')
  expect(source()).toBe('За налаштуваннями звіту')
  const unmarked = await submitted(view, 3)
  expect(Object.hasOwn(unmarked, 'profitReadMode')).toBe(false)
})
it('hides current opt-in without a confirmed capability', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, { ...profitDayDataset, profitReadMode: undefined }])
  await openWorkbook('Валовий прибуток за днем')
  expect(screen.queryByRole('combobox', { name: 'Джерело розрахунку' })).toBeNull()
})

it('uses the complete legacy Fenix scope for the date picker after opting out of an explicit read mode', async () => {
  const period = { required: true, supported: true, maximumDays: 31, maximumMonths: null, minimumDate: null, maximumDate: '2030-12-31' }
  const configuration = { version: 1, axisMode: 'profitRows', allowedRows: [3, 4], allowedColumns: [], minimumRows: 1,
    maximumRows: 2, allowRowReorder: true, rowLayouts: [], columnLayouts: [[]], mutuallyExclusiveRows: [], period,
    variants: [{ key: 'originalNormal', period: { ...period, maximumDays: null, maximumMonths: 120, maximumDate: '2099-12-31' } }] }
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, { ...profitDayDataset, configuration }])
  await openWorkbook('Валовий прибуток за днем')
  mode('За налаштуваннями звіту')
  fireEvent.click(screen.getByRole('button', { name: /^Період:/ }))
  expect(screen.getByLabelText('До').getAttribute('max')).toBe('2099-12-31')
  fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Група «Покупці» Fenix' }))
  fireEvent.click(screen.getByRole('button', { name: /^Період:/ }))
  expect(screen.getByLabelText('До').getAttribute('max')).toBe('2030-12-31')
})

it('selects client/agreement axes and blocks a mode switch without dropping dates, filters or groupings', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, currentFinancialDataset, profitSupplierDataset])
  const view = await openWorkbook('Валовий прибуток за днем')
  fireEvent.click(screen.getByRole('button', { name: 'Видалити Дата' }))
  fireEvent.click(screen.getByRole('button', { name: 'Видалити Організація' }))
  for (const [axis, label] of [['рядків', 'Клієнт'], ['стовпців', 'Договір']]) {
    fireEvent.click(screen.getByRole('button', { name: `Додати поле: Групування ${axis}` }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: label }))
  }
  expect(screen.getByText('У файлі кожен договір у колонках буде окремим аркушем.')).toBeTruthy()
  changeReportPeriod({ from: '2026-10-17', to: '2026-10-23' })
  const before = await submitted(view, 1)
  expect(before.sorted.Row.map(f => f.type)).toEqual([12])
  expect(before.sorted.Col.map(f => f.type)).toEqual([15])
  mode('Збережені регістри 1С')
  expect(screen.getAllByText(/Групування за клієнтом і договором доступне лише/).length).toBeGreaterThan(0)
  fireEvent.submit(view.container.querySelector('form')!)
  expect(createStockReport).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Видалити Клієнт' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Видалити Договір' })).toBeTruthy()
  mode('Поточні документи GBA')
  const after = await submitted(view, 2)
  expect(after).toEqual(before)
})
