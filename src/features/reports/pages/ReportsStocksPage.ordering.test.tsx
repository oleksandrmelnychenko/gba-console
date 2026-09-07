import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { accountBalanceSelections } from '../data/accountBalances.test-fixtures'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { accountOrdering, orderedAccountDataset, orderedAccountRequest } from '../data/reportOrdering.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
async function select(name: string, option: string) { fireEvent.click(screen.getByRole('combobox', { name })); fireEvent.click(await screen.findByRole('option', { name: option })) }
async function ready() { const view = render(<Providers><ReportsStocksPage /></Providers>); await screen.findByRole('button', { name: 'Продажі за днями' }); return view }
async function accountRule() {
  await select('Набір даних звіту', orderedAccountDataset.Name)
  await select('Сортування — Рядки: Рахунок', 'За підсумком показника')
  await select('Напрямок — Рядки: Рахунок', 'За спаданням')
}

describe('constructor typed group ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, orderedAccountDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
    vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: (template.Revision ?? 0) + 1 }))
  })
  it('sends the exact selected rule and active measure without adding a browser sorter or a valuation parameter', async () => {
    const { container } = await ready(); await accountRule()
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual(orderedAccountRequest())
    expect(screen.getByText(/Точний підпис включає надрукований/)).toBeTruthy()
  })
  it('moves a rule with its group between axes and explicitly clears it when that group is removed', async () => {
    const { container } = await ready(); await accountRule()
    fireEvent.click(screen.getByRole('button', { name: 'Перенести Рахунок до стовпців' }))
    expect(screen.getByText('Правило сортування перенесено разом із полем на іншу вісь.')).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Сортування — Стовпці: Рахунок' }) as HTMLInputElement).value).toBe('За підсумком показника')
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].ordering).toEqual({ Version: 1, Rows: [], Columns: accountOrdering.Rows })
    const columns = screen.getByRole('region', { name: 'Групування стовпців' })
    fireEvent.click(within(columns).getByRole('button', { name: 'Видалити Рахунок' }))
    expect(screen.getByText(/Правила сортування для полів Рахунок також видалено/)).toBeTruthy()
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    expect(vi.mocked(createStockReport).mock.calls[1][0].ordering).toEqual({ Version: 1, Rows: [], Columns: [] })
  })
  it('keeps disabled-measure ordering visible and blocks generation until its active measure is restored', async () => {
    const { container } = await ready(); await accountRule()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Записаний залишок рахунку' }))
    expect(screen.getByText('Сортування поля «Рахунок»: виберіть один увімкнений показник. Правило збережено.')).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Показник сортування — Рядки: Рахунок' }) as HTMLInputElement).value).toBe('Вимкнений показник: Записаний залишок рахунку')
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(container.querySelector('form')!); expect(createStockReport).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Записаний залишок рахунку' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].ordering).toEqual(accountOrdering)
  })
  it('restores and updates exact ordering with all filter flags and private template identity unchanged', async () => {
    const template = { Id: crypto.randomUUID(), Revision: 3, Name: 'Впорядковані рахунки', Data: { ...orderedAccountRequest(), selections: structuredClone(accountBalanceSelections) } }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template]); await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(await screen.findByRole('button', { name: /Впорядковані рахунки/ }))
    expect((screen.getByRole('combobox', { name: 'Напрямок — Рядки: Рахунок' }) as HTMLInputElement).value).toBe('За спаданням')
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0]).toEqual(template)
  })
  it.each([{ ...accountOrdering, Version: 9 }, { ...accountOrdering, Sql: 'ORDER BY Amount' }])('refuses unknown imported ordering before changing the current form %#', async ordering => {
    const template = { Id: crypto.randomUUID(), Revision: 1, Name: 'Невідоме сортування', Data: { ...orderedAccountRequest(), ordering } }, original = structuredClone(template)
    vi.mocked(getServerReportTemplates).mockResolvedValue([template]); await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(await screen.findByRole('button', { name: /Невідоме сортування/ }))
    expect(screen.getByText(/Невідома версія або некоректні правила сортування/)).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Набір даних звіту' }) as HTMLInputElement).value).toBe(reportDatasets[0].Name)
    expect(template).toEqual(original); expect(createStockReport).not.toHaveBeenCalled(); expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })
  it('clears ordering only through an explicit action and does not leak it to another dataset', async () => {
    const { container } = await ready(); await accountRule()
    fireEvent.click(screen.getByRole('button', { name: 'Очистити збережене сортування' }))
    expect(screen.getByText(/Збережене сортування явно очищено/)).toBeTruthy()
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).not.toHaveProperty('ordering')
    await select('Сортування — Рядки: Рахунок', 'За значенням поля')
    await select('Набір даних звіту', reportDatasets[0].Name)
    fireEvent.click(screen.getByRole('button', { name: 'Продажі за днями' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    expect(vi.mocked(createStockReport).mock.calls[1][0]).not.toHaveProperty('ordering')
  })
})
