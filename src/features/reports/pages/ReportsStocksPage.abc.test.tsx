import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { abcClass, abcDataset, abcRequest, accountAbc } from '../data/reportAbcClassification.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
async function select(name: string, option: string) { fireEvent.click(screen.getByRole('combobox', { name })); fireEvent.click(await screen.findByRole('option', { name: option })) }
const saved = () => ({ Id: crypto.randomUUID(), Revision: 3, Name: 'ABC рахунків', Data: abcRequest() })
async function ready() { const view = render(<Providers><ReportsStocksPage /></Providers>); await screen.findByRole('button', { name: 'Продажі за днями' }); return view }
async function applySaved() { fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(await screen.findByRole('button', { name: /ABC рахунків/ })) }

describe('server-computed ABC constructor', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, abcDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
    vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: (template.Revision ?? 0) + 1 }))
  })
  it('explicitly adds one real class row, allows its row order and refuses column transfer without calculating classes', async () => {
    const { container } = await ready(); await select('Набір даних звіту', abcDataset.Name)
    expect(screen.queryByRole('button', { name: 'Видалити ABC-клас' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Увімкнути ABC-класифікацію' }))
    await select('Початковий ключ для ABC', 'Рахунок')
    const transfer = screen.getByRole('button', { name: 'Перенести ABC-клас до стовпців' }) as HTMLButtonElement
    expect(transfer.disabled).toBe(true)
    fireEvent.click(transfer)
    fireEvent.click(screen.getByRole('button', { name: 'Перемістити ABC-клас нижче' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    const data = vi.mocked(createStockReport).mock.calls[0][0]
    expect(data.abcClassification).toEqual(accountAbc)
    expect(data.sorted.Row[1]).toEqual(abcClass)
    expect(data.sorted.Row.filter(field => field.type === 46)).toHaveLength(1)
    expect(data.sorted.Col).toEqual([])
    expect(data).not.toHaveProperty('classes')
  })
  it('keeps raw percentages on blur, requires sum100, and never derives C from the other inputs', async () => {
    vi.mocked(getServerReportTemplates).mockResolvedValue([saved()]); const { container } = await ready(); await applySaved()
    const a = screen.getByRole('textbox', { name: 'Частка A для ABC, %' }) as HTMLInputElement
    fireEvent.change(a, { target: { value: '101' } }); fireEvent.blur(a)
    expect(a.value).toBe('101')
    expect((screen.getByRole('textbox', { name: 'Частка C для ABC, %' }) as HTMLInputElement).value).toBe('5')
    expect(screen.getByText(/ABC: введіть цілі відсотки/)).toBeTruthy()
    fireEvent.submit(container.querySelector('form')!); expect(createStockReport).not.toHaveBeenCalled()
    fireEvent.change(a, { target: { value: '' } }); fireEvent.blur(a); expect(a.value).toBe('')
    fireEvent.submit(container.querySelector('form')!); expect(createStockReport).not.toHaveBeenCalled()
    fireEvent.change(a, { target: { value: '79' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Частка B для ABC, %' }), { target: { value: '16' } })
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].abcClassification).toEqual({ ...accountAbc, PercentA: 79, PercentB: 16 })
  })
  it('preserves TOP, ordering, class hierarchy, full filter tree and private revision through apply/save and explicit disable', async () => {
    const template = saved(); vi.mocked(getServerReportTemplates).mockResolvedValue([template]); const { container } = await ready(); await applySaved()
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual(template.Data)
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0]).toEqual(template)
    fireEvent.click(screen.getByRole('button', { name: 'Вимкнути ABC-класифікацію' }))
    expect(screen.getByText(/ABC вимкнено. Видалено поле/)).toBeTruthy()
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    const { abcClassification, ...expected } = template.Data
    expect(abcClassification).toEqual(accountAbc)
    expect(vi.mocked(createStockReport).mock.calls[1][0]).toEqual({ ...expected,
      sorted: { ...expected.sorted, Row: expected.sorted.Row.filter(field => field.type !== 46) },
      ordering: { ...expected.ordering, Rows: expected.ordering.Rows.filter(rule => rule.Grouping !== 46) } })
  }, 10000)
  it('blocks a moved native target, disabled ranking measure or deleted class without dropping ABC', async () => {
    vi.mocked(getServerReportTemplates).mockResolvedValue([saved()]); const { container } = await ready(); await applySaved()
    fireEvent.click(screen.getByRole('button', { name: 'Перенести Рахунок до стовпців' }))
    expect(screen.getByText(/ABC: виберіть рівно один наявний/)).toBeTruthy()
    fireEvent.submit(container.querySelector('form')!); expect(createStockReport).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Перенести Рахунок до рядків' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Записаний залишок рахунку' }))
    expect(screen.getByText(/ABC: виберіть один увімкнений показник/)).toBeTruthy()
    fireEvent.submit(container.querySelector('form')!); expect(createStockReport).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Записаний залишок рахунку' }))
    fireEvent.click(screen.getByRole('button', { name: 'Видалити ABC-клас' }))
    expect(screen.getByText(/ABC: поле «ABC-клас» має бути вибране/)).toBeTruthy()
    fireEvent.submit(container.querySelector('form')!); expect(createStockReport).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Додати поле: Групування рядків' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'ABC-класABC-клас' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].abcClassification).toEqual(accountAbc)
  }, 10000)
  it('preserves ABC on a same-source preset and clears it only on explicit dataset reset', async () => {
    vi.mocked(getServerReportTemplates).mockResolvedValue([saved()]); const { container } = await ready(); await applySaved()
    fireEvent.click(screen.getByRole('button', { name: 'Рахунки за призначенням і валютою' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual(abcRequest())
    await select('Набір даних звіту', reportDatasets[0].Name); fireEvent.click(screen.getByRole('button', { name: 'Продажі за днями' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    expect(vi.mocked(createStockReport).mock.calls[1][0]).not.toHaveProperty('abcClassification')
    expect(vi.mocked(createStockReport).mock.calls[1][0].sorted.Row.some(field => field.type === 46)).toBe(false)
  })
  it.each([{ ...accountAbc, Version: 99, Extra: true }, { ...accountAbc, PercentC: 6 }])('refuses an invalid saved rule before changing the form %#', async abcClassification => {
    const template = { ...saved(), Data: { ...abcRequest(), abcClassification } }, original = structuredClone(template)
    vi.mocked(getServerReportTemplates).mockResolvedValue([template]); await ready(); await applySaved()
    expect(screen.getByText(/Невідома версія або некоректне правило ABC|ABC: введіть цілі відсотки/)).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Набір даних звіту' }) as HTMLInputElement).value).toBe(reportDatasets[0].Name)
    expect(template).toEqual(original); expect(createStockReport).not.toHaveBeenCalled(); expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })
})
