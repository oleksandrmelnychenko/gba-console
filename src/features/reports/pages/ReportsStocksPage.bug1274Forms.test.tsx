import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  fireEvent.click(await screen.findByText('Часткові форми за зразками Excel'))
  fireEvent.click(screen.getByRole('button', { name: `Відкрити часткову форму: ${label}` }))
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
  await screen.findByText('Часткові форми за зразками Excel')
  for (const label of ['Валовий прибуток за днем', 'Валовий прибуток за постачальниками', 'Матриця товарів',
    'Рух коштів за період', 'Взаєморозрахунки за період', 'Дебіторка за період'])
    expect(screen.getByRole('button', { name: `Відкрити часткову форму: ${label}` })).toBeTruthy()
  fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(bug1274Datasets.map(dataset => dataset.Name))
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
}, 15_000)

it('opens the product matrix form without the original matrix', async () => {
  await openWorkbook('Матриця товарів')
  expect(screen.getByText(/Товар → сім атрибутів/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Переглянути оригінальну матрицю' })).toBeNull()
  expect(screen.queryByText('Оберіть звіт у полі «Набір даних звіту» або відкрийте часткову форму за зразком Excel.')).toBeNull()
})
