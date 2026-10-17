import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
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

vi.mock('../reportSurfacePolicy', () => ({ BUG_1274_ONLY_REPORT_SURFACE: true }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({ DocumentExportModal: () => null }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))

const bug1274Datasets = [profitDayDataset, profitSupplierDataset, currentVparivanieDataset, cashModeDataset, settlementModeDataset]
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, ...bug1274Datasets])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
})
const page = () => <MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>
async function openWorkbook(label: string) {
  const view = render(page())
  await screen.findByText('Звіти 1С за зразками Excel')
  fireEvent.click(screen.getByRole('button', { name: `Відкрити ${WORKBOOK_FILES[label] ?? label}` }))
  await waitFor(() => expect(screen.queryByText(/застосовуються відбори книги/i)).toBeNull())
  return view
}
function sourceOptions() {
  const select = screen.getByRole('combobox', { name: 'Джерело розрахунку' }) as HTMLInputElement
  fireEvent.click(select)
  const options = screen.getAllByRole('option').map(option => option.textContent)
  fireEvent.keyDown(select, { key: 'Escape' })
  return { value: select.value, options }
}

it('offers the six workbook forms of the five BUG-1274 reports and only their datasets', async () => {
  render(page())
  await screen.findByText('Звіти 1С за зразками Excel')
  for (const label of ['Валовий прибуток за днем', 'Валовий прибуток за постачальниками', 'Матриця товарів',
    'Рух коштів за період', 'Взаєморозрахунки за період', 'Дебіторка за період'])
    expect(screen.getByRole('button', { name: `Відкрити ${WORKBOOK_FILES[label] ?? label}` })).toBeTruthy()
  fireEvent.click(screen.getByRole('combobox', { name: 'Звіт' }))
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Валовий прибуток', 'Валовий прибуток по постачальниках', 'Впарювання', 'Відомість по коштах', 'Взаєморозрахунки з контрагентами'])
})

it.each([
  ['Валовий прибуток за днем', 35, 'profitReadMode'],
  ['Валовий прибуток за постачальниками', 38, 'profitReadMode'],
  ['Рух коштів за період', 40, 'cashReadMode'],
  ['Взаєморозрахунки за період', 41, 'settlementReadMode'],
  ['Дебіторка за період', 41, 'settlementReadMode'],
] as const)('opens «%s» on current GBA documents without the 1C register source', async (label, dataSource, modeKey) => {
  const view = await openWorkbook(label)
  expect(sourceOptions()).toEqual({ value: 'Поточні документи GBA', options: ['Поточні документи GBA'] })
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({ dataSource, [modeKey]: 0 })
})

it('opens the product matrix form without the original matrix', async () => {
  await openWorkbook('Матриця товарів')
  expect(screen.getByText(/Товар → сім атрибутів/)).toBeTruthy()
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
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  const request = vi.mocked(createStockReport).mock.calls[0][0]
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
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0].selections.map(selection => [selection.SelectedField.Type,
    selection.FilterCondition.Type, selection.Values.map(value => value.Data.Id)])).toEqual([[4, 6, ['3996']], [5, 0, ['613989']]])
})

it('lists the six workbooks under their 1C report names and keeps one compact row after opening one', async () => {
  render(page())
  const list = await screen.findByRole('region', { name: 'Звіти 1С за зразками Excel' })
  for (const title of ['Валовий прибуток', 'Валовий прибуток по постачальниках', 'Впарювання', 'Відомість по коштах',
    'Взаєморозрахунки з контрагентами', 'Відомість по взаєморозрахунках з контрагентами'])
    expect(within(list).getByText(title)).toBeTruthy()
  expect(within(list).queryByText(/Часткова|набір даних|режим/)).toBeNull()
  fireEvent.click(within(list).getByRole('button', { name: 'Відкрити ВП.xls' }))
  expect(await screen.findByText('ВП.xls — Валовий прибуток')).toBeTruthy()
  const compact = screen.getByRole('region', { name: 'Звіти 1С за зразками Excel' })
  expect(within(compact).getByRole('button', { name: 'Відкрити ВП.xls' }).getAttribute('aria-current')).toBe('true')
  expect(within(compact).getAllByRole('button')).toHaveLength(6)
  expect(within(compact).queryByText('Валовий прибуток по постачальниках')).toBeNull()
})

it('opens ВП.xls on the current month, says why a too long period is refused and «Скинути» restores the workbook', async () => {
  await openWorkbook('Валовий прибуток за днем')
  const yesterday = previousKyivDay(formatKyivBusinessDate())
  const from = () => (screen.getByLabelText('Від') as HTMLInputElement).value
  expect(from()).toBe(`${yesterday.slice(0, 7)}-01`)
  expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe(yesterday)
  fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-01-01' } })
  fireEvent.change(screen.getByLabelText('До'), { target: { value: '2026-09-30' } })
  await waitFor(() => expect(document.getElementById('report-constructor-blocked-reason')?.textContent).toMatch(/\d+/))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Група «Покупці» Fenix' }))
  fireEvent.click(screen.getByRole('button', { name: 'Скинути' }))
  await waitFor(() => expect(from()).toBe(`${yesterday.slice(0, 7)}-01`))
  expect((screen.getByRole('checkbox', { name: 'Група «Покупці» Fenix' }) as HTMLInputElement).checked).toBe(true)
  expect(document.getElementById('report-constructor-blocked-reason')).toBeNull()
})
