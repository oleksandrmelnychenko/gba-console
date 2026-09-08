import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { importedPaymentsDataset, importedPaymentsRequest } from '../data/importedPayments.test-fixtures'
import { IMPORTED_PAYMENTS_CAPTIONS } from '../data/importedPayments'
import { grossDataset } from '../data/reportDatasets.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
async function ready() { const view = render(<Providers><ReportsStocksPage /></Providers>); await screen.findByRole('button', { name: 'Продажі за днями' }); return view }
async function choose() {
  fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
  fireEvent.click(await screen.findByRole('option', { name: importedPaymentsDataset.Name }))
}
function periods() {
  for (const [label, value] of [['Від', '2026-07-01'], ['До', '2026-07-31']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
}

describe('source14 constructor and private templates', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([grossDataset, importedPaymentsDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
    vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: 4 }))
  })
  it('offers date-based currency/direction/account defaults and selected subset without comparison controls', async () => {
    const { container } = await ready(); await choose(); periods()
    expect(screen.queryByLabelText('Період порівняння: від')).toBeNull()
    expect(screen.getByRole('button', { name: 'Додати поле: Групування стовпців' })).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: IMPORTED_PAYMENTS_CAPTIONS[1] }))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual({ ...importedPaymentsRequest(), sorted: {
      ...importedPaymentsRequest().sorted, Measurements: importedPaymentsRequest().sorted.Measurements.filter(item => item.Type !== 30) } })
  })
  it('selects the exact agreement ID through source14 lookup and preserves the document period on generation', async () => {
    const user = userEvent.setup(), { container } = await ready(); await choose(); periods()
    vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: 455430, Name: 'Договір [455430]', AgreementId: 802 }])
    fireEvent.click(screen.getByRole('button', { name: 'Додати умову' }))
    const dialog = screen.getByRole('dialog', { name: 'Додати умову відбору' })
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Поле' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Договір' }))
    await user.type(within(dialog).getByRole('combobox', { name: 'Значення' }), '455430')
    await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(14, 9, { limit: 30, offset: 0, value: '455430' }, expect.any(AbortSignal)))
    fireEvent.click(await screen.findByRole('option', { name: 'Договір [455430]' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].selections[0].Values[0].Data).toMatchObject({ Id: 455430, AgreementId: 802 })
    expect(vi.mocked(createStockReport).mock.calls[0][0].comparison).toBeUndefined()
  })
  it('restores dates and revision and refuses a later unsupported template before changing the form', async () => {
    const template = { Id: crypto.randomUUID(), Revision: 3, Name: 'Платежі за липень', Data: importedPaymentsRequest() }
    const invalid = { ...template, Id: crypto.randomUUID(), Name: 'Платежі з порогом', Data: { ...template.Data, threshold: { Version: 1 } } }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template, invalid])
    const { container } = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(await screen.findByRole('button', { name: /Платежі за липень/ }))
    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-07-01')
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual(template.Data)
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Оновити шаблон' })[0])
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0]).toEqual(template)
    fireEvent.click(screen.getByRole('button', { name: /Платежі з порогом/ }))
    expect(screen.getByText(/Записані імпортовані платежі містять непідтримувані/)).toBeTruthy()
    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-07-01')
  })
  it('restores a selected measurement whose IsChecked flag is omitted', async () => {
    const data = importedPaymentsRequest(); data.sorted.Measurements = [{ ...data.sorted.Measurements[2] }]
    Reflect.deleteProperty(data.sorted.Measurements[0], 'IsChecked')
    vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 1, Name: 'Різниця платежів', Data: data }])
    const { container } = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(await screen.findByRole('button', { name: /Різниця платежів/ }))
    expect((screen.getByRole('checkbox', { name: IMPORTED_PAYMENTS_CAPTIONS[2] }) as HTMLInputElement).checked).toBe(true)
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].sorted.Measurements.map(item => item.Type)).toEqual([31])
  })

})
