import { workbookDisplayFileName } from '../data/bug1274WorkbookGuide'
import { changeReportPeriod, readReportDateInput } from '../testing/reportPeriod'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { previewStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { profitDayDataset, profitSupplierDataset } from '../data/profitReadMode.test-fixtures'
import { cashModeDataset } from '../data/cashReadMode.test-fixtures'
import { settlementModeDataset } from '../data/settlementReadMode.test-fixtures'
import { currentVparivanieDataset } from '../data/currentVparivanie.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'
import { previousKyivDay } from '../data/cashPeriod'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import { WORKBOOK_FILES } from '../testing/workbookFiles'
import { expandWorkbookSettings, findOpenedWorkbook, openWorkbookSettingsSection, openWorkbookAdvanced } from '../testing/workbookDesk'

vi.mock('../reportSurfacePolicy', () => ({ BUG_1274_ONLY_REPORT_SURFACE: true }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: () => null }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), previewStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))

const bug1274Datasets = [profitDayDataset, profitSupplierDataset, currentVparivanieDataset, cashModeDataset, settlementModeDataset]
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, ...bug1274Datasets])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(previewStockReport).mockResolvedValue({ result: { document: {}, raw: {} }, preview: {
    Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null,
    Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
    RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [],
  } })
})
const page = () => <MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>
async function openWorkbook(label: string) {
  const view = render(page())
  await findOpenedWorkbook('ВП.xls')
  fireEvent.click(screen.getByRole('button', { name: `Відкрити ${workbookDisplayFileName(WORKBOOK_FILES[label] ?? label)}` }))
  await waitFor(() => expect(screen.queryByText(/застосовуються відбори книги/i)).toBeNull())
  expandWorkbookSettings()
  openWorkbookAdvanced()
  return view
}
it('offers the six workbook forms of the five BUG-1274 reports and only their datasets', async () => {
  render(page())
  const switcher = await findOpenedWorkbook('ВП.xls')
  for (const label of ['Валовий прибуток за днем', 'Валовий прибуток за постачальниками', 'Матриця товарів',
    'Рух коштів за період', 'Взаєморозрахунки за період', 'Дебіторка за період'])
    expect(within(switcher).getByRole('button', { name: `Відкрити ${workbookDisplayFileName(WORKBOOK_FILES[label] ?? label)}` })).toBeTruthy()
  expect(within(switcher).getAllByRole('button', { name: /^Відкрити / })).toHaveLength(6)
  expect(screen.queryByRole('combobox', { name: 'Звіт' })).toBeNull()
})

it.each([
  ['Валовий прибуток за днем', 35, 'profitReadMode', ['Розрахунок валового прибутку']],
  ['Валовий прибуток за постачальниками', 38, 'profitReadMode', ['Розрахунок за постачальниками']],
  ['Рух коштів за період', 40, 'cashReadMode', []],
  ['Взаєморозрахунки за період', 41, 'settlementReadMode', ['База взаєморозрахунків']],
  ['Дебіторка за період', 41, 'settlementReadMode', ['База взаєморозрахунків']],
] as const)('opens «%s» on current GBA documents without the 1C register source or locked one-value selects', async (label, dataSource, modeKey, locked) => {
  const view = await openWorkbook(label)
  for (const name of ['Джерело розрахунку', ...locked]) expect(screen.queryByRole('combobox', { name })).toBeNull()
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(previewStockReport).mock.calls[0][0]).toMatchObject({ dataSource, [modeKey]: 0 })
})

it('opens the product matrix form without the original matrix', async () => {
  await openWorkbook('Матриця товарів')
  expect(screen.queryByRole('heading', { name: 'Аналіз залишків і продажів' })).toBeNull()
  expect(screen.queryByText('Впарювання.xls')).toBeNull()
  expect(screen.getByRole('button', { name: 'Відкрити Аналіз залишків і продажів.xls' }).getAttribute('aria-current')).toBe('true')
  openWorkbookSettingsSection('Групування')
  expect(screen.getByText('Товари у рядках; залишки, продажі й контрагенти у стовпцях.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Переглянути оригінальну матрицю' })).toBeNull()
  expect(screen.queryByText('Відкрийте звіт 1С за зразком Excel вище або оберіть звіт у полі «Звіт».')).toBeNull()
})

it('opens the supplier workbook with its organizations, saved supplier list and «Покупці» resolved by name', async () => {
  vi.mocked(searchDatasetReportValues).mockImplementation(async (dataSource, field, params) => dataSource !== 38 ? []
    : field === 0 ? [{ Id: '10549', Name: 'ТОВ «АМГ «КОНКОРД» [10549]' }, { Id: '10550', Name: 'Фенікс [10550]' },
      { Id: '10551', Name: 'ФОП Самолюк Алла Дмитрівна [10551]' }, { Id: '10552', Name: 'ФОП Самолюк Юрій Миколайович [10552]' }]
    : params.value.startsWith('BENEFIT') ? [{ Id: '614427', Name: 'BENEFIT OTOMOTIV IC DIS TIC. LTD. STI,Туреччина [614427]' }] : [])
  const view = await openWorkbook('Валовий прибуток за постачальниками')
  expect(screen.getByText(/Не знайдено однозначно в GBA, тому не застосовано: YPS GLOBAL/)).toBeTruthy()
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  const request = vi.mocked(previewStockReport).mock.calls[0][0]
  expect(request).toMatchObject({ dataSource: 38, profitReadMode: 0,
    sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: '8AB2005056C0000811DEFC4535BB4D40' } })
  expect(request.selections.map(selection => [selection.SelectedField.Type, selection.FilterCondition.Type,
    selection.Values.map(value => value.Data.Id)])).toEqual([[0, 2, ['10549', '10550', '10551', '10552']], [17, 2, ['614427']]])
})

it('opens the product matrix workbook with the AL-KO group and АФРАКО resolved by name', async () => {
  vi.mocked(searchDatasetReportValues).mockImplementation(async (dataSource, field) => dataSource !== 39 ? []
    : field === 4 ? [{ Id: '3996', Name: 'AL-KO [3996]' }] : field === 5 ? [{ Id: '613989', Name: 'АФРАКО ТЗОВ [613989]' }] : [])
  const view = await openWorkbook('Матриця товарів')
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(previewStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(previewStockReport).mock.calls[0][0].selections.map(selection => [selection.SelectedField.Type,
    selection.FilterCondition.Type, selection.Values.map(value => value.Data.Id)])).toEqual([[4, 6, ['3996']], [5, 0, ['613989']]])
})

it('lists the six workbooks by name in one switcher row and opens the first one there', async () => {
  render(page())
  const switcher = await findOpenedWorkbook('ВП.xls')
  expect(screen.getAllByRole('navigation', { name: 'Звіти' })).toHaveLength(1)
  expect(within(switcher).getAllByRole('button', { name: /^Відкрити / }).map(tab => tab.textContent))
    .toEqual(['ВП', 'ВП по постачальниках', 'Аналіз залишків і продажів', 'Відомість по коштах', 'Взаєморозрахунки всі', 'Дебіторська заборгованість'])
  expect(within(switcher).queryByText(/Часткова|набір даних|режим/)).toBeNull()
  expect(within(switcher).queryByText('Валовий прибуток по постачальниках')).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Валовий прибуток' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Відкрити ВП.xls' }).getAttribute('aria-current')).toBe('true')
  fireEvent.click(within(switcher).getByRole('button', { name: 'Відкрити ВП по постачальниках.xls' }))
  await findOpenedWorkbook('ВП по постачальниках.xls')
  expect(screen.queryByRole('heading', { name: 'Валовий прибуток по постачальниках' })).toBeNull()
  expect(within(switcher).getByRole('button', { name: 'Відкрити ВП.xls' }).getAttribute('aria-current')).toBeNull()
  expect(within(switcher).getAllByRole('button', { name: /^Відкрити / })).toHaveLength(6)
})

it('opens ВП.xls on the current month, says why a too long period is refused and «Скинути» restores the workbook', async () => {
  await openWorkbook('Валовий прибуток за днем')
  const yesterday = previousKyivDay(formatKyivBusinessDate())
  const from = () => (readReportDateInput('Від') as HTMLInputElement).value
  expect(from()).toBe(`${yesterday.slice(0, 7)}-01`)
  expect((readReportDateInput('До') as HTMLInputElement).value).toBe(yesterday)
  changeReportPeriod({ from: '2026-01-01', to: '2026-09-30' })
  await waitFor(() => expect(document.getElementById('report-constructor-blocked-reason')?.textContent).toMatch(/\d+/))
  openWorkbookSettingsSection('Відбори')
  fireEvent.click(screen.getByRole('checkbox', { name: 'Група «Покупці» Fenix' }))
  fireEvent.click(screen.getByRole('button', { name: 'Скинути' }))
  await waitFor(() => expect(from()).toBe(`${yesterday.slice(0, 7)}-01`))
  expect((screen.getByRole('checkbox', { name: 'Група «Покупці» Fenix' }) as HTMLInputElement).checked).toBe(true)
  expect(document.getElementById('report-constructor-blocked-reason')).toBeNull()
})
