import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { accountTop, topDataset, topRequest } from '../data/reportTopGroups.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
async function select(name: string, option: string) { fireEvent.click(screen.getByRole('combobox', { name })); fireEvent.click(await screen.findByRole('option', { name: option })) }
const saved = () => ({ Id: crypto.randomUUID(), Revision: 3, Name: 'TOP рахунків', Data: topRequest() })
async function ready() { const view = render(<Providers><ReportsStocksPage /></Providers>); await screen.findByRole('button', { name: 'Продажі за днями' }); return view }
async function applySaved() { fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(await screen.findByRole('button', { name: /TOP рахунків/ })) }

describe('whole-group TOP constructor controls', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, topDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
    vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: (template.Revision ?? 0) + 1 }))
  })
  it('enables TOP using selected fields only and sends percent/cardinality mode separately from display sorting', async () => {
    const { container } = await ready(); await select('Набір даних звіту', topDataset.Name)
    fireEvent.click(screen.getByRole('button', { name: 'Увімкнути TOP цілих груп' }))
    await select('Поле рядків для TOP', 'Рахунок'); await select('Режим TOP', 'Відсоток кількості груп')
    fireEvent.change(screen.getByRole('textbox', { name: 'Відсоток кількості груп TOP' }), { target: { value: '50' } })
    await select('Напрямок відбору TOP', 'Найменші значення')
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    const request = vi.mocked(createStockReport).mock.calls[0][0]
    expect(request.topGroups).toEqual({ ...accountTop, Mode: 2, Value: 50, Direction: 1 })
    expect(request).not.toHaveProperty('ordering'); expect(request.sorted.Measurements.map(item => item.Type)).toEqual([24])
    expect(screen.getByText(/50% від 3 груп — це 2 групи/)).toBeTruthy()
  })
  it('retains full saved TOP/filter/ordering configuration and private template revision through apply/update', async () => {
    const template = saved(); vi.mocked(getServerReportTemplates).mockResolvedValue([template]); const { container } = await ready(); await applySaved()
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual(template.Data)
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0]).toEqual(template)
  })
  it('blocks a moved or removed row target without deleting TOP and restores it when the exact group returns', async () => {
    vi.mocked(getServerReportTemplates).mockResolvedValue([saved()]); const { container } = await ready(); await applySaved()
    fireEvent.click(screen.getByRole('button', { name: 'Перенести Рахунок до стовпців' }))
    expect(screen.getByText(/TOP груп «Рахунок»: поле має бути вибране/)).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Поле рядків для TOP' }) as HTMLInputElement).value).toContain('Поза рядками')
    fireEvent.submit(container.querySelector('form')!); expect(createStockReport).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Перенести Рахунок до рядків' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].topGroups).toEqual(accountTop)
    fireEvent.click(screen.getByRole('button', { name: 'Видалити Рахунок' }))
    expect(screen.getByText(/TOP груп «Рахунок»: поле має бути вибране/)).toBeTruthy()
  })
  it('preserves disabled ranking measure, blank numeric draft and out-of-range percent without clamping', async () => {
    vi.mocked(getServerReportTemplates).mockResolvedValue([{ ...saved(), Data: { ...topRequest(), ordering: undefined } }])
    const { container } = await ready(); await applySaved()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Записаний залишок рахунку' }))
    expect(screen.getByText(/TOP груп: виберіть один увімкнений показник/)).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Показник для TOP' }) as HTMLInputElement).value).toContain('Вимкнений або недоступний')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Записаний залишок рахунку' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Кількість груп TOP' }), { target: { value: '500' } })
    await select('Режим TOP', 'Відсоток кількості груп')
    const value = screen.getByRole('textbox', { name: 'Відсоток кількості груп TOP' }) as HTMLInputElement
    fireEvent.blur(value); expect(value.value).toBe('500')
    expect(screen.getByText(/від 1 до 100 відсотків кількості груп/)).toBeTruthy()
    fireEvent.change(value, { target: { value: '' } }); fireEvent.submit(container.querySelector('form')!)
    expect(createStockReport).not.toHaveBeenCalled(); expect(value.value).toBe('')
    fireEvent.change(value, { target: { value: '50' } }); fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].topGroups).toEqual({ ...accountTop, Mode: 2, Value: 50 })
  })
  it('clears TOP explicitly or on dataset reset while preserving it through a same-source preset', async () => {
    vi.mocked(getServerReportTemplates).mockResolvedValue([saved()]); const { container } = await ready(); await applySaved()
    fireEvent.click(screen.getByRole('button', { name: 'Рахунки за призначенням і валютою' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual(topRequest())
    fireEvent.click(screen.getByRole('button', { name: 'Вимкнути TOP: залишити всі групи' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    expect(vi.mocked(createStockReport).mock.calls[1][0]).not.toHaveProperty('topGroups')
    fireEvent.click(screen.getByRole('button', { name: 'Увімкнути TOP цілих груп' }))
    await select('Набір даних звіту', reportDatasets[0].Name); fireEvent.click(screen.getByRole('button', { name: 'Продажі за днями' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(3))
    expect(vi.mocked(createStockReport).mock.calls[2][0]).not.toHaveProperty('topGroups')
  })
  it.each([{ ...accountTop, Version: 99, Extra: true }, { ...accountTop, Value: 0 }])('rejects invalid imported TOP before changing the current form %#', async topGroups => {
    const template = { ...saved(), Data: { ...topRequest(), topGroups } }, original = structuredClone(template)
    vi.mocked(getServerReportTemplates).mockResolvedValue([template]); await ready(); await applySaved()
    expect(screen.getByText(/Невідома версія або некоректні налаштування TOP груп|TOP груп: введіть ціле число/)).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Набір даних звіту' }) as HTMLInputElement).value).toBe(reportDatasets[0].Name)
    expect(template).toEqual(original); expect(createStockReport).not.toHaveBeenCalled(); expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })
})
