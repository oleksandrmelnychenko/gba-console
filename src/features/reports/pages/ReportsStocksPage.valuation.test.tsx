import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, getReportClientAgreements, searchDatasetReportValues, searchValuationAgreements } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { reportDatasets, currentStockDatasets, valuationDataset } from '../data/reportDatasets.test-fixtures'
import type { ReportRequestBody, ReportTemplate } from '../types'
import { ReportsStocksPage } from './ReportsStocksPage'

let allowed = true
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => allowed }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(),
  createStockReport: vi.fn(), getReportClientAgreements: vi.fn(), searchDatasetReportValues: vi.fn(), searchValuationAgreements: vi.fn(),
}))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(),
  getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn(),
}))
function Providers({ children }: { children: ReactNode }) {
  return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
}
async function ready() {
  const view = render(<Providers><ReportsStocksPage /></Providers>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  return view
}
async function chooseDataset(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
  fireEvent.click(await screen.findByRole('option', { name }))
}
async function chooseAgreement() {
  fireEvent.click(screen.getByRole('combobox', { name: 'Договір для оцінки' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Контрольний клієнт · Договір [459018]' }))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false))
}
function valuationTemplate(): ReportTemplate {
  return { Id: '10000000-0000-0000-0000-000000000008', Revision: 1, Name: 'Моя оцінка за договором',
    Data: { ...defaultDatasetRequest(valuationDataset, '', ''), valuationClientAgreementId: 459018,
      selections: [{ IsChecked: false, SelectedField: { Name: 'CustomerContract', Type: 9 },
        FilterCondition: { Name: 'Дорівнює', Type: 0 }, Values: [{ Data: { Id: 458945 }, Name: 'Збережений відбір', Value: 458945 }] }] } }
}

describe('current stock valuation by exact client agreement', () => {
  beforeEach(() => {
    allowed = true
    vi.clearAllMocks()
    localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, ...currentStockDatasets, valuationDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
    vi.mocked(searchValuationAgreements).mockResolvedValue([{ Id: 459018, Name: 'Контрольний клієнт · Договір [459018]' }])
    vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: 2 }))
  })

  it('requires a verified agreement, preserves it through presets, and clears it on dataset changes', async () => {
    const { container } = await ready()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-06-01' } })
    fireEvent.change(screen.getByLabelText('До'), { target: { value: '2026-06-30' } })
    await chooseDataset(valuationDataset.Name)
    expect(screen.queryByLabelText('Від')).toBeNull()
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(container.querySelector('form')!)
    expect(createStockReport).not.toHaveBeenCalled()
    await chooseAgreement()
    expect(searchValuationAgreements).toHaveBeenCalledWith({ value: '459018', limit: 30, offset: 0 }, expect.any(AbortSignal))
    expect(getReportClientAgreements).not.toHaveBeenCalled()
    expect(searchDatasetReportValues).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Оцінка за договором по складах' }))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({ dataSource: 8, valuationClientAgreementId: 459018,
      from: '', to: '', selections: [], sorted: { Row: [{ type: 29 }, { type: 28 }], Measurements: [{ Type: 17 }, { Type: 21 }] } })
    await chooseDataset(reportDatasets[0].Name)
    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-06-01')
    expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe('2026-06-30')
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    expect(vi.mocked(createStockReport).mock.calls[1][0]).not.toHaveProperty('valuationClientAgreementId')
    await chooseDataset(valuationDataset.Name)
    expect((screen.getByRole('combobox', { name: 'Договір для оцінки' }) as HTMLInputElement).value).toBe('')
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('loads and updates an exact valuation template without making its disabled ownership condition active', async () => {
    const template = valuationTemplate()
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    const { container } = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(await screen.findByRole('button', { name: /Моя оцінка за договором/ }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false))
    expect((screen.getByRole('combobox', { name: 'Договір для оцінки' }) as HTMLInputElement).value).toBe('Контрольний клієнт · Договір [459018]')
    expect((screen.getByRole('checkbox', { name: 'Умова відбору 1' }) as HTMLInputElement).checked).toBe(false)
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({ valuationClientAgreementId: 459018, selections: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data).toEqual(template.Data)
  })

  it.each([undefined, 0, -1, '459018'])('refuses a saved invalid valuation identity %s before changing the form', async identity => {
    const template = valuationTemplate()
    template.Data = { ...template.Data, valuationClientAgreementId: identity } as unknown as ReportRequestBody
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    await ready()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-06-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(await screen.findByRole('button', { name: /Моя оцінка за договором/ }))
    expect(screen.getByText('Виберіть точний договір клієнта для оцінки залишків.')).toBeTruthy()
    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-06-01')
    expect(searchValuationAgreements).not.toHaveBeenCalled()
    expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })

  it('blocks a template whose exact agreement is no longer available and permits an explicit retry', async () => {
    vi.mocked(getServerReportTemplates).mockResolvedValue([valuationTemplate()])
    vi.mocked(searchValuationAgreements).mockResolvedValue([])
    const { container } = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(await screen.findByRole('button', { name: /Моя оцінка за договором/ }))
    await screen.findByText('Обраний договір недоступний для оцінки. Виберіть доступний договір.')
    fireEvent.submit(container.querySelector('form')!)
    expect(createStockReport).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
    vi.mocked(searchValuationAgreements).mockResolvedValue([{ Id: 459018, Name: 'Контрольний клієнт · Договір [459018]' }])
    fireEvent.click(screen.getByRole('button', { name: 'Перевірити ще раз' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false))
  })

  it('rechecks permission before using a previously selected agreement', async () => {
    const { container, rerender } = await ready()
    await chooseDataset(valuationDataset.Name)
    await chooseAgreement()
    allowed = false
    rerender(<Providers><ReportsStocksPage /></Providers>)
    fireEvent.submit(container.querySelector('form')!)
    expect(createStockReport).not.toHaveBeenCalled()
    expect((screen.getByRole('combobox', { name: 'Договір для оцінки' }) as HTMLInputElement).disabled).toBe(true)
  })
  it('serializes axis reordering and transfers while preserving exact valuation, disabled filters and unchecked measures', async () => {
    const template = valuationTemplate()
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    const { container } = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(await screen.findByRole('button', { name: /Моя оцінка за договором/ }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Оцінка за договором, EUR' }))
    const rows = () => screen.getByRole('region', { name: 'Групування рядків' })
    const columns = () => screen.getByRole('region', { name: 'Групування стовпців' })
    fireEvent.click(within(rows()).getByRole('button', { name: 'Перемістити Одиниця виміру вище' }))
    expect(within(rows()).getAllByLabelText(/Рівень/).map(item => item.parentElement?.textContent)).toEqual(['1Одиниця виміру','2Склад'])
    fireEvent.click(within(rows()).getByRole('button', { name: 'Перемістити Одиниця виміру нижче' }))
    fireEvent.click(within(rows()).getByRole('button', { name: 'Перенести Склад до стовпців' }))
    expect((within(rows()).getByRole('button', { name: 'Перенести Одиниця виміру до стовпців' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Додати поле: Групування рядків' }))
    const picker = screen.getByRole('dialog', { name: 'Додати поле · Групування рядків' })
    expect(within(picker).queryByRole('button', { name: /^Склад$/ })).toBeNull()
    expect(within(picker).queryByRole('button', { name: /^Одиниця виміру$/ })).toBeNull()
    fireEvent.click(within(picker).getByRole('button', { name: /Артикул/ }))
    fireEvent.click(within(rows()).getByRole('button', { name: 'Перенести Артикул до стовпців' }))
    fireEvent.click(within(columns()).getByRole('button', { name: 'Перемістити Артикул вище' }))
    fireEvent.click(within(columns()).getByRole('button', { name: 'Перенести Склад до рядків' }))
    expect((screen.getByRole('checkbox', { name: 'Оцінка за договором, EUR' }) as HTMLInputElement).checked).toBe(false)
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    const generated = vi.mocked(createStockReport).mock.calls[0][0]
    expect(generated.sorted.Row.map(item => item.type)).toEqual([28,29])
    expect(generated.sorted.Col.map(item => item.type)).toEqual([6])
    expect(generated.sorted.Measurements.map(item => item.Type)).toEqual([17])
    expect(generated).toMatchObject({dataSource:8,valuationClientAgreementId:459018,from:'',to:'',selections:[]})
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    const saved = vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data
    expect(saved).toEqual({...generated,selections:template.Data.selections})
    expect(template.Data.sorted.Row.map(item => item.type)).toEqual([29,28])
    expect(template.Data.sorted.Measurements.map(item => item.Type)).toEqual([17,21])
  })

})
