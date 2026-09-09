import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { rateDataset, rateRequest } from '../data/rateComparison.test-fixtures'
import { RATE_COMPARISON_CAPTIONS } from '../data/rateComparison'
import { grossDataset } from '../data/reportDatasets.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
async function ready() { const view = render(<Providers><ReportsStocksPage /></Providers>); await screen.findByRole('button', { name: 'Продажі за днями' }); return view }
async function choose() {
  fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
  fireEvent.click(await screen.findByRole('option', { name: rateDataset.Name }))
}
function dates(from = '2026-07-01', to = '2026-07-31') {
  fireEvent.change(screen.getByLabelText('Від'), { target: { value: from } })
  fireEvent.change(screen.getByLabelText('До'), { target: { value: to } })
}
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
afterAll(() => { if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll); else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView') })
function points(CurrentAsOf = '2026-07-31', PreviousAsOf = '2026-06-30') {
  fireEvent.change(screen.getByLabelText('Курс: поточна дата'), { target: { value: CurrentAsOf } })
  fireEvent.change(screen.getByLabelText('Курс: дата порівняння'), { target: { value: PreviousAsOf } })
}
async function series(user: ReturnType<typeof userEvent.setup>, id = '9007199254740993') {
  await user.click(screen.getByRole('combobox', { name: 'Валютна пара і серія' }))
  await user.type(screen.getByRole('combobox', { name: 'Валютна пара і серія' }), id)
  fireEvent.click(await screen.findByRole('option', { name: `Комерційний: EUR [CurrencyID=2] → UAH [CurrencyID=3] [RateDefinitionID=${id}]` }))
}
describe('source19 explicit series constructor', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([grossDataset, rateDataset]); vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} }); vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: 4 }))
    vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: '9007199254740993', Name: 'Комерційний: EUR [CurrencyID=2] → UAH [CurrencyID=3] [RateDefinitionID=9007199254740993]' }] as unknown as Awaited<ReturnType<typeof searchDatasetReportValues>>)
  })
  it('requires series and two dates, exposes no generic period/filter/grouping and preserves selected order', async () => {
    const user = userEvent.setup(), { container } = await ready(); await choose()
    expect(screen.queryByLabelText('Від')).toBeNull(); expect(screen.queryByLabelText('До')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Додати умову' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Додати поле: Групування/ })).toBeNull()
    expect(screen.queryByText('Поточний стан на час читання даних. Історичний період не застосовується.')).toBeNull()
    expect(screen.getByLabelText('Параметри історичних курсів').closest('.reports-stocks-body')).toBeTruthy()
    points(); expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
    await series(user); fireEvent.click(screen.getByRole('checkbox', { name: RATE_COMPARISON_CAPTIONS[1] }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    const request = vi.mocked(createStockReport).mock.calls[0][0]
    expect(request).toMatchObject({ from: '', to: '', selections: [], rateComparison: { RateDefinitionId: '9007199254740993', CurrentAsOf: '2026-07-31', PreviousAsOf: '2026-06-30' } })
    expect(request.sorted.Row.map(item => item.type)).toEqual([52]); expect(request.sorted.Col).toEqual([]); expect(request.sorted.Measurements.map(item => item.Type)).toEqual([51, 53, 54])
    expect(screen.queryByText('Поточний стан', { exact: true })).toBeNull()
  })
  it('accepts reversed/equal dates and clears exact definition on rate-kind change', async () => {
    const user = userEvent.setup(), { container } = await ready(); await choose(); await series(user)
    points('1900-01-01', '9998-12-31'); fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    points('2026-03-29', '2026-03-29'); fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('combobox', { name: 'Тип курсу' })); fireEvent.click(await screen.findByRole('option', { name: 'Державний' }))
    await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(19, 40, expect.objectContaining({ value: '' }), expect.any(AbortSignal)))
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('loads exact saved options, resets explicit inputs and retains prior source dates on switching', async () => {
    const data = rateRequest()
    vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: crypto.randomUUID(), Name: 'Історичний курс', Revision: 1, Data: data }])
    await ready(); dates('2026-05-01', '2026-05-31')
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(await screen.findByRole('button', { name: /Історичний курс/ }))
    expect((screen.getByLabelText('Курс: поточна дата') as HTMLInputElement).value).toBe('2026-07-31')
    fireEvent.click(screen.getByRole('button', { name: 'Скинути' }))
    expect((screen.getByLabelText('Курс: поточна дата') as HTMLInputElement).value).toBe('')
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
