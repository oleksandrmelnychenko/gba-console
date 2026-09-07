import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { reportDatasets, purchaseDataset } from '../data/reportDatasets.test-fixtures'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { createSalesReportPreset } from '../data/reportPresets'
import type { ReportTemplate } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async (original) => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async (original) => ({
  ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn(),
}))

function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}

async function renderReady() {
  const view = render(<Providers><ReportsStocksPage /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  return view
}

async function chooseDataset(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
  fireEvent.click(await screen.findByRole('option', { name }))
}

function storedTemplate(dataSource = 3): ReportTemplate {
  const data = defaultDatasetRequest(purchaseDataset, '2026-09-01', '2026-09-03')
  data.dataSource = dataSource
  data.selections = [{ IsChecked: false, SelectedField: { Type: 18, Name: 'SupplierContract' },
    FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [{ Data: { Id: 42, Name: 'Договір 42' }, Name: 'Договір 42', Value: 42 }] }]
  return { Id: '10000000-0000-0000-0000-000000000001', Revision: 1, Name: 'Мій шаблон надходжень', Data: data }
}

describe('native report datasets in the constructor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue(reportDatasets)
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
    vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: 77, Name: 'м' }])
    vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: 1 }))
  })

  it('switches to purchase facts, keeps dates and uses only supported measures', async () => {
    const { container } = await renderReady()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('До'), { target: { value: '2026-09-03' } })
    fireEvent.click(screen.getByRole('button', { name: 'Продажі за договорами' }))
    await chooseDataset('Надходження товарів')
    expect(screen.queryByRole('button', { name: 'Продажі за договорами' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Кількість надходжень' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Вартість надходження без ПДВ, EUR' })).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: 'Продажі з ПДВ' })).toBeNull()
    expect(screen.getByText('Суми з ПДВ не включені.')).toBeTruthy()
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 3, from: '2026-09-01', to: '2026-09-03',
      selections: [], sorted: { Row: [{ type: 28 }, { type: 3 }], Col: [], Measurements: [{ Type: 0 }, { Type: 2 }] } })
  })

  it.each(reportDatasets)('selects the unit preset and exact unit filter in source $DataSource', async dataset => {
    const { container } = await renderReady()
    if (dataset.DataSource !== 0) await chooseDataset(dataset.Name)
    fireEvent.click(screen.getByRole('button', { name: 'Кількість за одиницями' }))
    fireEvent.click(screen.getByRole('button', { name: 'Додати умову' }))
    const editor = await screen.findByRole('dialog', { name: 'Додати умову відбору' })
    fireEvent.click(within(editor).getByRole('combobox', { name: 'Поле' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Одиниця виміру' }))
    // Units such as «м» and «л» must work without a two-character minimum.
    await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(dataset.DataSource, 20,
      { limit: 30, offset: 0, value: '' }, expect.any(AbortSignal)))
    fireEvent.click(within(editor).getByRole('combobox', { name: 'Значення' }))
    fireEvent.click(await screen.findByRole('option', { name: 'м' }))
    fireEvent.click(within(editor).getByRole('button', { name: 'Зберегти' }))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({ dataSource: dataset.DataSource,
      sorted: { Row: [{ type: 28, key: 'ProductMeasureUnit' }, { type: 3 }], Measurements: [{ Type: 0 }] },
      selections: [{ SelectedField: { Type: 20, Name: 'ProductMeasureUnit' },
        Values: [{ Data: { Id: 77, Name: 'м' }, Name: 'м', Value: 77 }] }] })
  })

  it('uses net sales presets only when every grouping is supported', async () => {
    const { container } = await renderReady()
    await chooseDataset('Продажі з поверненнями')
    expect(screen.queryByRole('button', { name: 'Продажі за відповідальними 1С' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Чисті продажі за договорами' }))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 2, sorted: { Row: [{ type: 4 }, { type: 12 }, { type: 15 }] } })
  })

  it('restores a purchase template and saves its source and disabled exact contract and unit filters', async () => {
    const template = storedTemplate()
    template.Data.selections.push({ IsChecked: false, SelectedField: { Type: 20, Name: 'ProductMeasureUnit' },
      FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [{ Data: { Id: 77, Name: 'м' }, Name: 'м', Value: 77 }] })
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    await renderReady()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(await screen.findByRole('button', { name: /Мій шаблон надходжень/ }))
    expect((screen.getByRole('combobox', { name: 'Набір даних звіту' }) as HTMLInputElement).value).toBe('Надходження товарів')
    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-09-01')
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data).toMatchObject({ dataSource: 3, selections: template.Data.selections,
      sorted: { Row: [{ type: 28, key: 'ProductMeasureUnit' }, { type: 3 }] } })
  })

  it('restores and saves existing price groupings 26/27 without treating either as a quantity unit', async () => {
    const priceFields = [{ Type: 26, Name: 'Ціна продажу з ПДВ, EUR' }, { Type: 27, Name: 'Собівартість одиниці з ПДВ, EUR' }]
    vi.mocked(getReportDatasets).mockResolvedValue([{ ...reportDatasets[0], Groupings: [...reportDatasets[0].Groupings, ...priceFields] }, ...reportDatasets.slice(1)])
    const template = createSalesReportPreset('daily', '2026-09-01', '2026-09-03', [])
    template.Name = 'Ціновий шаблон'
    template.Data.dataSource = 0
    template.Data.sorted.Row = [{ type: 26, key: 'SalesUnitGrossPrice', label: priceFields[0].Name }]
    template.Data.sorted.Col = [{ type: 27, key: 'CostUnitGrossPrice', label: priceFields[1].Name }]
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    await renderReady()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(await screen.findByRole('button', { name: /Ціновий шаблон/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data.sorted).toMatchObject({
      Row: [{ type: 26, key: 'SalesUnitGrossPrice', label: priceFields[0].Name }],
      Col: [{ type: 27, key: 'CostUnitGrossPrice', label: priceFields[1].Name }],
    })
  })

  it.each([1, 99])('refuses saved source %s without changing the current form', async source => {
    vi.mocked(getServerReportTemplates).mockResolvedValue([storedTemplate(source)])
    await renderReady()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-08-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(await screen.findByRole('button', { name: /Мій шаблон надходжень/ }))
    expect(screen.getByText(/Налаштування не застосовано/)).toBeTruthy()
    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-08-01')
    expect((screen.getByRole('combobox', { name: 'Набір даних звіту' }) as HTMLInputElement).value).toBe('Продажі')
  })

  it('refuses unsupported saved filters instead of sanitizing them', async () => {
    const template = { ...storedTemplate(0), Data: createSalesReportPreset('agreements', '2026-09-01', '2026-09-03', [{
      IsChecked: true, SelectedField: { Type: 9, Name: 'CustomerContract' },
      FilterCondition: { Type: 6, Name: 'У групі' }, Values: [{ Data: { Id: 42 }, Name: '42', Value: 42 }],
    }]).Data }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    await renderReady()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(await screen.findByRole('button', { name: /Мій шаблон надходжень/ }))
    expect(screen.getByText(/не підтримує налаштування: CustomerContract/)).toBeTruthy()
    expect(createStockReport).not.toHaveBeenCalled()
    expect(template.Data.selections[0].FilterCondition.Type).toBe(6)
  })

  it('blocks generation when capabilities fail to load and allows a retry', async () => {
    vi.mocked(getReportDatasets).mockRejectedValueOnce(new Error('Немає зв’язку із сервером'))
    const { container } = render(<Providers><ReportsStocksPage /></Providers>)
    await screen.findByText('Немає зв’язку із сервером')
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(container.querySelector('form')!)
    expect(createStockReport).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
    await screen.findByRole('button', { name: 'Продажі за днями' })
    expect(getReportDatasets).toHaveBeenCalledTimes(2)
  })
})
