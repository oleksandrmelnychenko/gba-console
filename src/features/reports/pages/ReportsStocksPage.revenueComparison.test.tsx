import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { revenueDataset, revenueRequest } from '../data/revenueComparison.test-fixtures'
import { REVENUE_COMPARISON_CAPTIONS, defaultRevenueComparison } from '../data/revenueComparison'
import { grossDataset } from '../data/reportDatasets.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
async function ready() { const view = render(<Providers><ReportsStocksPage /></Providers>); await screen.findByRole('button', { name: 'Продажі за днями' }); return view }
async function choose() {
  fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
  fireEvent.click(await screen.findByRole('option', { name: revenueDataset.Name }))
}
function dates(from = '2026-07-01', to = '2026-07-31') {
  fireEvent.change(screen.getByLabelText('Від'), { target: { value: from } })
  fireEvent.change(screen.getByLabelText('До'), { target: { value: to } })
}
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
afterAll(() => { if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll); else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView') })
function previous(from = '2026-06-01', to = '2026-06-30') {
  fireEvent.change(screen.getByLabelText('Виручка: порівняння від'), { target: { value: from } })
  fireEvent.change(screen.getByLabelText('Виручка: порівняння до'), { target: { value: to } })
}
describe('source16 builder and precise contract templates', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([grossDataset, revenueDataset]); vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} }); vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: 4 }))
  })
  it('requires two explicit windows and fixed client/CA rows; places settings in body with no unsupported panels', async () => {
    const { container } = await ready(); await choose(); dates()
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
    previous(); expect(screen.getByLabelText('Параметри порівняння виручки').closest('.reports-stocks-body')).toBeTruthy()
    expect(screen.getByLabelText('Параметри порівняння виручки').closest('.reports-stocks-filter-scroll')).toBeNull()
    expect(screen.queryByRole('button', { name: /Додати поле: Групування/ })).toBeNull()
    for (const label of ['TOP цілих груп', 'Поріг групування', 'ABC-класифікація', 'Приховування нулів']) expect(screen.queryByText(label, { exact: true })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: REVENUE_COMPARISON_CAPTIONS[1] })); fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    const request = vi.mocked(createStockReport).mock.calls[0][0]
    expect(request.revenueComparison).toEqual({ ...defaultRevenueComparison(), From: '2026-06-01', To: '2026-06-30' })
    expect(request.sorted.Row.map(v => v.type)).toEqual([12, 15]); expect(request.sorted.Col).toEqual([])
    expect(request.sorted.Measurements.map(v => v.Type)).toEqual([35, 37, 38]); expect(request).not.toHaveProperty('xyz'); expect(request).not.toHaveProperty('comparison')
  })
  it('preserves overlapping, unequal and reverse chronological windows without aligning them', async () => {
    const { container } = await ready(); await choose(); dates('2026-03-28', '2026-03-30'); previous('2026-10-24', '2026-10-26')
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({ from: '2026-03-28', to: '2026-03-30', revenueComparison: { From: '2026-10-24', To: '2026-10-26' } })
    dates('2026-06-15', '2026-07-15'); previous('2026-07-01', '2026-07-31')
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    expect(vi.mocked(createStockReport).mock.calls[1][0]).toMatchObject({ from: '2026-06-15', to: '2026-07-15', revenueComparison: { From: '2026-07-01', To: '2026-07-31' } })
  })
  it('uses exact large ClientAgreement lookup identity while descriptive Value remains Int32 zero', async () => {
    const user = userEvent.setup(), { container } = await ready(); await choose(); dates(); previous()
    const entity = { Id: '9007199254740993', Name: 'Договір [9007199254740993]', AgreementId: 900 }
    vi.mocked(searchDatasetReportValues).mockResolvedValue([entity] as unknown as Awaited<ReturnType<typeof searchDatasetReportValues>>)
    fireEvent.click(screen.getByRole('button', { name: 'Додати умову' })); const dialog = screen.getByRole('dialog', { name: 'Додати умову відбору' })
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Поле' })); fireEvent.click(await screen.findByRole('option', { name: 'Договір' }))
    await user.type(within(dialog).getByRole('combobox', { name: 'Значення' }), entity.Id)
    await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(16, 9, { limit: 30, offset: 0, value: entity.Id }, expect.any(AbortSignal)))
    fireEvent.click(await screen.findByRole('option', { name: entity.Name })); fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].selections[0].Values[0]).toEqual({ Data: entity, Name: entity.Name, Value: 0 })
  })
  it('reloads caller measure order, exact legacy JSON-string Id and revision; refuses unsupported template before changing form', async () => {
    const data = revenueRequest(); data.sorted.Measurements.reverse()
    data.selections = [{ SelectedField: { Type: 9, Name: 'Contract' }, FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [{ Data: '{"Id":"9223372036854775807"}', Value: 0, Name: 'Точний договір' }] }] as unknown as typeof data.selections
    const template = { Id: crypto.randomUUID(), Revision: 3, Name: 'Виручка точні періоди', Data: data }
    const invalid = { ...template, Id: crypto.randomUUID(), Name: 'Виручка непідтримана', Data: { ...data, ordering: { Version: 1 } } }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template, invalid]); const { container } = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(await screen.findByRole('button', { name: /Виручка точні періоди/ }))
    expect((screen.getByRole('checkbox', { name: 'Умова відбору 1' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual(data)
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(screen.getAllByRole('button', { name: 'Оновити шаблон' })[0])
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce()); expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0]).toEqual(template)
    fireEvent.click(screen.getByRole('button', { name: /Виручка непідтримана/ })); expect(screen.getByText(/Перевірте порівняння виручки/)).toBeTruthy()
    expect((screen.getByLabelText('Виручка: порівняння від') as HTMLInputElement).value).toBe('2026-06-01')
  })
})
