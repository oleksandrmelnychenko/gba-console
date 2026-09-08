import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { salesXyzDataset, salesXyzRequest } from '../data/salesXyz.test-fixtures'
import { XYZ_CAPTIONS, defaultXyzOptions, XYZ_POLICIES } from '../data/salesXyz'
import { grossDataset } from '../data/reportDatasets.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
async function ready() { const view = render(<Providers><ReportsStocksPage /></Providers>); await screen.findByRole('button', { name: 'Продажі за днями' }); return view }
async function choose() {
  fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
  fireEvent.click(await screen.findByRole('option', { name: salesXyzDataset.Name }))
}
function dates(from = '2026-05-01', to = '2026-07-31') {
  fireEvent.change(screen.getByLabelText('Від'), { target: { value: from } })
  fireEvent.change(screen.getByLabelText('До'), { target: { value: to } })
}
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
afterAll(() => { if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll); else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView') })
describe('XYZ builder exact periods, bounds and templates', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([grossDataset, salesXyzDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
    vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: 4 }))
  })
  it('uses fixed class/product rows, explicit calendar and selected measures with no extra operations', async () => {
    const { container } = await ready(); await choose(); dates()
    expect(screen.getByText('Клас XYZ → Товар. Показники у стовпцях; структура цього звіту фіксована.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Додати поле: Групування/ })).toBeNull()
    for (const caption of XYZ_CAPTIONS) expect(screen.getByRole('checkbox', { name: caption })).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: XYZ_CAPTIONS[1] }))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    const request = vi.mocked(createStockReport).mock.calls[0][0]
    expect(request.xyz).toEqual(defaultXyzOptions()); expect(request.sorted.Row.map(v => v.type)).toEqual([51, 5])
    expect(request.sorted.Col).toEqual([]); expect(request.sorted.Measurements.map(v => v.Type)).toEqual([32, 34])
    expect(request).not.toHaveProperty('ordering'); expect(request).not.toHaveProperty('comparison')
  })
  it('keeps invalid dates and precision as entered; touched policy supports N3/K4 without normalization', async () => {
    const user = userEvent.setup(), { container } = await ready(); await choose(); dates('2026-04-16', '2026-07-15')
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('combobox', { name: 'Календар XYZ' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Місяці у вибраному вікні' }))
    const lower = screen.getByLabelText('X: нижня межа, % (не включно)')
    await user.clear(lower); await user.type(lower, '-3,125')
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
    expect((lower as HTMLInputElement).value).toBe('-3,125')
    await user.clear(lower); await user.type(lower, '-3,12')
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({ from: '2026-04-16', to: '2026-07-15',
      xyz: { ...defaultXyzOptions(), CalendarPolicy: XYZ_POLICIES[1], Bounds: { ...defaultXyzOptions().Bounds, XLower: -3.12 } } })
  })
  it('uses exact source15 ClientAgreement lookup, retaining sibling AgreementId only as descriptor', async () => {
    const user = userEvent.setup(), { container } = await ready(); await choose(); dates()
    vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: 202, Name: 'Договір [202]', AgreementId: 900 }])
    fireEvent.click(screen.getByRole('button', { name: 'Додати умову' }))
    const dialog = screen.getByRole('dialog', { name: 'Додати умову відбору' })
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Поле' }))
    fireEvent.click(await screen.findByRole('option', { name: salesXyzDataset.Filters.find(field => field.Type === 9)!.Name }))
    await user.type(within(dialog).getByRole('combobox', { name: 'Значення' }), '202')
    await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(15, 9, { limit: 30, offset: 0, value: '202' }, expect.any(AbortSignal)))
    fireEvent.click(await screen.findByRole('option', { name: 'Договір [202]' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].selections[0].Values[0].Data).toEqual({ Id: 202, Name: 'Договір [202]', AgreementId: 900 })
  })
  it('reloads exact parameters/revision, saves a clone and refuses unsupported template without mutating form', async () => {
    const data = salesXyzRequest(); (data.xyz as ReturnType<typeof defaultXyzOptions>).Bounds.XUpper = -4.12
    const template = { Id: crypto.randomUUID(), Revision: 3, Name: 'XYZ точні межі', Data: data }
    const invalid = { ...template, Id: crypto.randomUUID(), Name: 'XYZ непідтриманий', Data: { ...data, ordering: { Version: 1 } } }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template, invalid])
    const { container } = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(await screen.findByRole('button', { name: /XYZ точні межі/ }))
    expect((screen.getByLabelText('X: верхня межа, % (включно)') as HTMLInputElement).value).toBe('-4,12')
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual(data)
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Оновити шаблон' })[0])
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0]).toEqual(template)
    fireEvent.click(screen.getByRole('button', { name: /XYZ непідтриманий/ }))
    expect(screen.getByText(/Перевірте параметри XYZ/)).toBeTruthy()
    expect((screen.getByLabelText('X: верхня межа, % (включно)') as HTMLInputElement).value).toBe('-4,12')
  })
  it('shows an omitted selection flag as active and preserves exact string Id and descriptor Value0 after reload', async () => {
    const data = salesXyzRequest()
    data.selections = [{ SelectedField: { Type: 9, Name: 'Contract' }, FilterCondition: { Type: 0, Name: 'Дорівнює' },
      Values: [{ Data: { Id: '9223372036854775807', AgreementId: 900 }, Value: 0, Name: 'Точний договір' }] }] as unknown as typeof data.selections
    const template = { Id: crypto.randomUUID(), Revision: 2, Name: 'XYZ активна умова', Data: data }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    const { container } = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(await screen.findByRole('button', { name: /XYZ активна умова/ }))
    const checkbox = screen.getByRole('checkbox', { name: 'Умова відбору 1' }) as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].selections).toEqual(data.selections)
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(false)
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    expect(vi.mocked(createStockReport).mock.calls[1][0].selections).toEqual([{ ...data.selections[0], IsChecked: false }])
  })

})
