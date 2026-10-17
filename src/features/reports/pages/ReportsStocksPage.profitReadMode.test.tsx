import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { profitDayDataset, profitSupplierDataset } from '../data/profitReadMode.test-fixtures'
import { DAY_ORGANIZATION_GOODS_KIND_ID, DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS } from '../data/dayOrganizationGrossProfit'
import { FENIX_BUYERS_ROOT_ID } from '../data/nativeExactFilters'
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
  await waitFor(() => expect(screen.queryByText(/застосовуються відбори книги/)).toBeNull())
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
  expect(screen.getByText(/Типове джерело: продажі та повернення з поточних документів GBA за період до 31 календарних днів/)).toBeTruthy()
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
