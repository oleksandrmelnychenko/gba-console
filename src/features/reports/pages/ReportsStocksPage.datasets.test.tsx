import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { reportDatasets, purchaseDataset } from '../data/reportDatasets.test-fixtures'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { createSalesReportPreset } from '../data/reportPresets'
import type { ReportTemplate } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async (original) => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
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
      selections: [], sorted: { Row: [{ type: 3 }], Col: [], Measurements: [{ Type: 0 }, { Type: 2 }] } })
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

  it('restores a purchase template and saves its source and disabled exact contract filter', async () => {
    const template = storedTemplate()
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    await renderReady()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(await screen.findByRole('button', { name: /Мій шаблон надходжень/ }))
    expect((screen.getByRole('combobox', { name: 'Набір даних звіту' }) as HTMLInputElement).value).toBe('Надходження товарів')
    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-09-01')
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data).toMatchObject({ dataSource: 3, selections: template.Data.selections })
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
