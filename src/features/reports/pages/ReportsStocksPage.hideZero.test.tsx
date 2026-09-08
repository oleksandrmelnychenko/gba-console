import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { hideZeroDataset, hideZeroRequest } from '../data/reportHideZero.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
async function select(name: string, option: string) { fireEvent.click(screen.getByRole('combobox', { name })); fireEvent.click(await screen.findByRole('option', { name: option })) }
const saved = () => ({ Id: crypto.randomUUID(), Revision: 3, Name: 'Приховані нулі рахунків', Data: hideZeroRequest() })
async function ready() { const view = render(<Providers><ReportsStocksPage /></Providers>); await screen.findByRole('button', { name: 'Продажі за днями' }); return view }
async function applySaved() { fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(await screen.findByRole('button', { name: /Приховані нулі рахунків/ })) }
const disable = () => fireEvent.click(screen.getByRole('button', { name: 'Показувати підтверджені нулі' }))

describe('server-proven HideZero constructor', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, hideZeroDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
    vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: (template.Revision ?? 0) + 1 }))
  })
  it('requires deliberate record-grain preparation and never changes the default layout when enabling is unavailable', async () => {
    const { container } = await ready(); await select('Набір даних звіту', hideZeroDataset.Name)
    expect((screen.getByRole('button', { name: 'Приховувати підтверджені нулі' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Приховувати підтверджені нулі' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    const data = vi.mocked(createStockReport).mock.calls[0][0]
    expect(data.sorted.Row.map(field => field.type)).toEqual([45, 44, 41, 40])
    expect(data).not.toHaveProperty('hideZero')
  })
  it('round-trips native filters, hierarchy, TOP, ABC, ordering and private revision; explicit disable removes only HideZero', async () => {
    const template = saved(); vi.mocked(getServerReportTemplates).mockResolvedValue([template]); const { container } = await ready(); await applySaved()
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual(template.Data)
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0]).toEqual(template)
    disable(); fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    const { hideZero, ...expected } = template.Data
    expect(hideZero).toEqual({ Version: 1 })
    expect(vi.mocked(createStockReport).mock.calls[1][0]).toEqual(expected)
    fireEvent.click(screen.getByRole('button', { name: 'Приховувати підтверджені нулі' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(3))
    expect(vi.mocked(createStockReport).mock.calls[2][0]).toEqual(template.Data)
  }, 10000)
  it('retains HideZero when its native group moves or its measure is disabled and restores validity explicitly', async () => {
    vi.mocked(getServerReportTemplates).mockResolvedValue([saved()]); const { container } = await ready(); await applySaved()
    fireEvent.click(screen.getByRole('button', { name: 'Перенести Запис залишку рахунку до стовпців' }))
    expect(screen.getByText(/Приховування нулів потребує лише поля/)).toBeTruthy()
    fireEvent.submit(container.querySelector('form')!); expect(createStockReport).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Показувати підтверджені нулі' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Перенести Запис залишку рахунку до рядків' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Записаний залишок рахунку' }))
    expect(screen.getByText(/Приховування нулів потребує одного увімкненого показника/)).toBeTruthy()
    fireEvent.submit(container.querySelector('form')!); expect(createStockReport).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Записаний залишок рахунку' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].hideZero).toEqual({ Version: 1 })
  }, 10000)
  it('preserves the rule on a same-source preset and clears it on an explicit dataset switch', async () => {
    vi.mocked(getServerReportTemplates).mockResolvedValue([saved()]); const { container } = await ready(); await applySaved()
    fireEvent.click(screen.getByRole('button', { name: 'Рахунки за призначенням і валютою' }))
    expect(screen.getByText(/Приховування нулів потребує лише поля/)).toBeTruthy()
    fireEvent.submit(container.querySelector('form')!); expect(createStockReport).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Показувати підтверджені нулі' })).toBeTruthy()
    await select('Набір даних звіту', reportDatasets[0].Name); fireEvent.click(screen.getByRole('button', { name: 'Продажі за днями' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).not.toHaveProperty('hideZero')
  })
  it.each([{ hideZero: { Version: 99, Extra: true } }, { hideZero: { Version: '1' } }, { HideZero: { Version: 1 } }])('keeps invalid saved settings unchanged and refuses apply/save before replacing current form %#', async patch => {
    const template = { ...saved(), Data: { ...hideZeroRequest(), ...patch } }, original = structuredClone(template)
    vi.mocked(getServerReportTemplates).mockResolvedValue([template]); await ready(); await applySaved()
    expect(screen.getByText(/Невідома версія або некоректне правило приховування нулів|Приховування нулів задано двічі/)).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Набір даних звіту' }) as HTMLInputElement).value).toBe(reportDatasets[0].Name)
    expect(template).toEqual(original); expect(createStockReport).not.toHaveBeenCalled(); expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })
})
