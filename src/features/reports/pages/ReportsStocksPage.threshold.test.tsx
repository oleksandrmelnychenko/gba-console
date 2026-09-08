import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { accountThreshold, thresholdDataset, thresholdRequest } from '../data/reportThreshold.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
async function select(name: string, option: string) { fireEvent.click(screen.getByRole('combobox', { name })); fireEvent.click(await screen.findByRole('option', { name: option })) }
const saved = () => ({ Id: crypto.randomUUID(), Revision: 3, Name: 'Поріг рахунків', Data: thresholdRequest() })
async function ready() { const view = render(<Providers><ReportsStocksPage /></Providers>); await screen.findByRole('button', { name: 'Продажі за днями' }); return view }
async function applySaved() { fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(await screen.findByRole('button', { name: /Поріг рахунків/ })) }
const disable = () => fireEvent.click(screen.getByRole('button', { name: 'Вимкнути поріг: показати початкові групи' }))

describe('server-computed threshold constructor', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, thresholdDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
    vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: (template.Revision ?? 0) + 1 }))
  })
  it('requires deliberate layout preparation and enabling without dropping other grouping fields', async () => {
    const { container } = await ready(); await select('Набір даних звіту', thresholdDataset.Name)
    expect((screen.getByRole('button', { name: 'Увімкнути поріг групування' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Увімкнення порогу не змінює ваші поля автоматично/)).toBeTruthy()
    for (const name of ['Призначення рахунку', 'Тип рахунку', 'Валюта рахунку']) fireEvent.click(screen.getByRole('button', { name: `Видалити ${name}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Увімкнути поріг групування' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    const data = vi.mocked(createStockReport).mock.calls[0][0]
    expect(data.threshold).toEqual(accountThreshold)
    expect(data.sorted.Row.map(field => field.type)).toEqual([40])
    expect(data).not.toHaveProperty('otherGroups')
    expect(screen.getByText(/Звичайні відбори за товарами, договорами та іншими полями залишаються доступними/)).toBeTruthy()
    expect(screen.getByText(/Об’єднання лише нульових груп сервер відхилить/)).toBeTruthy()
  })
  it('round-trips native filters, hierarchy, TOP, ABC, ordering and private revision; explicit disable removes only threshold', async () => {
    const template = saved(); vi.mocked(getServerReportTemplates).mockResolvedValue([template]); const { container } = await ready(); await applySaved()
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual(template.Data)
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0]).toEqual(template)
    disable(); fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    const { threshold, ...expected } = template.Data
    expect(threshold).toEqual(accountThreshold)
    expect(vi.mocked(createStockReport).mock.calls[1][0]).toEqual(expected)
    fireEvent.click(screen.getByRole('button', { name: 'Увімкнути поріг групування' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(3))
    expect(vi.mocked(createStockReport).mock.calls[2][0]).toEqual(template.Data)
  }, 10000)
  it('retains unclamped 101 and blank input, blocks POST, and submits the explicit corrected integer', async () => {
    vi.mocked(getServerReportTemplates).mockResolvedValue([saved()]); const { container } = await ready(); await applySaved()
    const percent = screen.getByRole('textbox', { name: 'Поріг частки суми, %' }) as HTMLInputElement
    for (const value of ['101', '']) {
      fireEvent.change(percent, { target: { value } }); fireEvent.blur(percent); expect(percent.value).toBe(value)
      fireEvent.submit(container.querySelector('form')!); expect(createStockReport).not.toHaveBeenCalled()
    }
    fireEvent.change(percent, { target: { value: '37' } }); fireEvent.blur(percent)
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].threshold).toEqual({ ...accountThreshold, Percent: 37 })
  })
  it('retains the threshold when its native group moves or its measure is disabled and restores validity explicitly', async () => {
    vi.mocked(getServerReportTemplates).mockResolvedValue([saved()]); const { container } = await ready(); await applySaved()
    fireEvent.click(screen.getByRole('button', { name: 'Перенести Рахунок до стовпців' }))
    expect(screen.getByText(/Поріг потребує рівно одного початкового поля рядків/)).toBeTruthy()
    fireEvent.submit(container.querySelector('form')!); expect(createStockReport).not.toHaveBeenCalled()
    expect((screen.getByRole('textbox', { name: 'Поріг частки суми, %' }) as HTMLInputElement).value).toBe('20')
    fireEvent.click(screen.getByRole('button', { name: 'Перенести Рахунок до рядків' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Записаний залишок рахунку' }))
    expect(screen.getByText(/Поріг потребує рівно одного увімкненого показника/)).toBeTruthy()
    fireEvent.submit(container.querySelector('form')!); expect(createStockReport).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Записаний залишок рахунку' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].threshold).toEqual(accountThreshold)
  }, 10000)
  it('preserves the rule on a same-source preset and clears it on an explicit dataset switch', async () => {
    vi.mocked(getServerReportTemplates).mockResolvedValue([saved()]); const { container } = await ready(); await applySaved()
    fireEvent.click(screen.getByRole('button', { name: 'Рахунки за призначенням і валютою' }))
    expect(screen.getByText(/Поріг потребує рівно одного початкового поля рядків/)).toBeTruthy()
    fireEvent.submit(container.querySelector('form')!); expect(createStockReport).not.toHaveBeenCalled()
    expect((screen.getByRole('textbox', { name: 'Поріг частки суми, %' }) as HTMLInputElement).value).toBe('20')
    await select('Набір даних звіту', reportDatasets[0].Name); fireEvent.click(screen.getByRole('button', { name: 'Продажі за днями' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).not.toHaveProperty('threshold')
  })
  it.each([{ threshold: { ...accountThreshold, Version: 99, Extra: true } }, { threshold: { ...accountThreshold, Percent: 101 } }, { Threshold: accountThreshold }])('keeps invalid saved settings unchanged and refuses apply/save before replacing current form %#', async patch => {
    const template = { ...saved(), Data: { ...thresholdRequest(), ...patch } }, original = structuredClone(template)
    vi.mocked(getServerReportTemplates).mockResolvedValue([template]); await ready(); await applySaved()
    expect(screen.getByText(/Невідома версія або некоректне правило порогу|Поріг: введіть цілий відсоток|Поріг задано двічі/)).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Набір даних звіту' }) as HTMLInputElement).value).toBe(reportDatasets[0].Name)
    expect(template).toEqual(original); expect(createStockReport).not.toHaveBeenCalled(); expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })
})
