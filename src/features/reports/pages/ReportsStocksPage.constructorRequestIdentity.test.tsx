import fixture from '../data/constructorDatasets.dev-fixture.json'
import golden from '../data/constructorRequestIdentity.main-fixture.json'
import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, parseReportDatasets } from '../api/reportWorkspaceApi'
import { availableBug1274WorkbookLaunches, bug1274WorkbookRequest, PURCHASES_CONSTRUCTOR_FILE, STOCK_PERIOD_CONSTRUCTOR_FILE } from '../data/bug1274WorkbookLaunch'
import { GROSS_PROFIT_CONSTRUCTOR_WORKBOOK, SALES_CONSTRUCTOR_WORKBOOK } from '../data/salesConstructorProfiles'
import { CUSTOMER_GROUPS_WORKBOOK } from '../data/customerGroups'
import { NATIVE_PRICE_COMPARISON_WORKBOOK } from '../data/nativePriceComparison'
import { defaultDatasetRequest } from '../data/reportDatasets'
import type { ReportRequestBody, ReportTemplate } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: null, hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))

const datasets = parseReportDatasets(fixture)
const launches = availableBug1274WorkbookLaunches(datasets)
const organization = (ids: number[]) => ({ IsChecked: true, SelectedField: { Type: 0, Name: 'Organization' }, FilterCondition: { Type: 2, Name: 'У списку' },
  Values: ids.map(Id => ({ Data: { Id, Name: `Організація ${Id}` }, Name: `Організація ${Id}`, Value: Id })) })

function templateData(file: string): ReportRequestBody {
  const launch = launches.find(item => item.fileName === file)!
  const data = structuredClone(bug1274WorkbookRequest(defaultDatasetRequest(launch.dataset, '2026-10-01', '2026-10-31'), launch))
  data.from = '2026-10-01'
  data.to = '2026-10-31'
  if (file === SALES_CONSTRUCTOR_WORKBOOK) {
    data.sorted.Row = data.sorted.Row.filter(row => row.type === 4)
    data.sorted.Row.push({ type: 17, key: 'SaleDocument', label: 'Документ продажу' })
    data.sorted.Col = [{ type: 2, key: 'Month', label: 'По місяцях' }]
    data.constructorPresentation = { version: 1, negativeRed: false, grandTotals: true }
    data.selections = [organization([10561, 10562]), { IsChecked: false, SelectedField: { Type: 3, Name: 'ProductTop' }, FilterCondition: { Type: 0, Name: 'Дорівнює' },
      Values: [{ Data: { Id: 2, Name: 'A' }, Name: 'A', Value: 2 }] }]
  }
  if (file === GROSS_PROFIT_CONSTRUCTOR_WORKBOOK) {
    data.sorted.Measurements = data.sorted.Measurements.filter(item => [2, 6, 10].includes(item.Type))
    data.constructorPresentation = { version: 1, negativeRed: true, grandTotals: false }
    data.numberPresentation = { version: 1, moneyScale: 1000 }
    data.selections = [organization([10562])]
  }
  if (file === PURCHASES_CONSTRUCTOR_FILE || file === STOCK_PERIOD_CONSTRUCTOR_FILE) data.constructorPresentation = { version: 1, negativeRed: true, grandTotals: true }
  if (file === CUSTOMER_GROUPS_WORKBOOK) data.customerGroups = { Version: 1, Groups: [{ Name: 'Еталон', ClientIds: [71, 72] }, { Name: 'Набір B', ClientIds: [73] }] }
  if (file === NATIVE_PRICE_COMPARISON_WORKBOOK) data.nativePriceComparison = { Version: 2, PricingId: '5' }
  return data
}

const files = [SALES_CONSTRUCTOR_WORKBOOK, GROSS_PROFIT_CONSTRUCTOR_WORKBOOK, PURCHASES_CONSTRUCTOR_FILE, STOCK_PERIOD_CONSTRUCTOR_FILE, CUSTOMER_GROUPS_WORKBOOK, NATIVE_PRICE_COMPARISON_WORKBOOK]

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue(datasets)
  vi.mocked(getServerReportTemplates).mockResolvedValue(files.map((file, index): ReportTemplate => ({ Id: `identity-${index}`, Revision: 1, UpdatedAtUtc: '2026-11-01T10:00:00Z',
    Name: `Ідентичність ${index + 1}`, Data: templateData(file) })))
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: { Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null, Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false }, RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [] } })
})
afterEach(cleanup)

it('sends the same request bodies for saved constructor templates as the previous constructor layout', async () => {
  const { container } = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await screen.findByRole('navigation', { name: 'Звіти' })
  const sent: unknown[] = []
  for (const [index] of files.entries()) {
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    const dialog = await screen.findByRole('dialog', { name: 'Шаблони звіту' })
    fireEvent.click(await within(dialog).findByRole('button', { name: `Відкрити для редагування: Ідентичність ${index + 1}` }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Шаблони звіту' })).toBeNull())
    await act(async () => fireEvent.submit(container.querySelector('form.workbook-desk__form')!))
    await waitFor(() => expect(previewStockReport).toHaveBeenCalledTimes(index + 1))
    sent.push(JSON.parse(JSON.stringify(vi.mocked(previewStockReport).mock.calls[index][0])))
  }
  expect(sent).toEqual(golden)
}, 60000)
