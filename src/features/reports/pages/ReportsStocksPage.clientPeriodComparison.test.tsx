import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { clientComparisonDataset, clientComparisonRequest } from '../data/clientPeriodComparison.test-fixtures'
import { CLIENT_COMPARISON_CAPTIONS } from '../data/clientPeriodComparison'
import { grossDataset } from '../data/reportDatasets.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
async function ready() { const view = render(<Providers><ReportsStocksPage /></Providers>); await screen.findByRole('button', { name: 'Продажі за днями' }); return view }
async function choose() {
  fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' }))
  fireEvent.click(await screen.findByRole('option', { name: clientComparisonDataset.Name }))
}
function periods() {
  for (const [label, value] of [['Поточний період: від', '2026-07-01'], ['Поточний період: до', '2026-07-31'],
    ['Період порівняння: від', '2026-06-01'], ['Період порівняння: до', '2026-06-30']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
}

describe('source13 constructor and private templates', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([grossDataset, clientComparisonDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
    vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: 4 }))
  })
  it('requires a second explicit window and offers only supported rows and selectable four measures', async () => {
    const { container } = await ready(); await choose()
    expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Додати поле: Групування стовпців' })).toBeNull()
    periods()
    fireEvent.click(screen.getByRole('checkbox', { name: CLIENT_COMPARISON_CAPTIONS[0] }))
    fireEvent.click(screen.getByRole('checkbox', { name: CLIENT_COMPARISON_CAPTIONS[2] }))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toMatchObject({ ...clientComparisonRequest(),
      sorted: { ...clientComparisonRequest().sorted, Measurements: clientComparisonRequest().sorted.Measurements.filter(item => [26, 28].includes(item.Type)) } })
  })
  it('selects the exact agreement ID through source13 lookup and preserves both periods on generation', async () => {
    const user = userEvent.setup(), { container } = await ready(); await choose(); periods()
    vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: 455430, Name: 'Договір [455430]', AgreementId: 802 }])
    fireEvent.click(screen.getByRole('button', { name: 'Додати умову' }))
    const dialog = screen.getByRole('dialog', { name: 'Додати умову відбору' })
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Поле' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Договір клієнта' }))
    await user.type(within(dialog).getByRole('combobox', { name: 'Значення' }), '455430')
    await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(13, 9, { limit: 30, offset: 0, value: '455430' }, expect.any(AbortSignal)))
    fireEvent.click(await screen.findByRole('option', { name: 'Договір [455430]' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].selections[0].Values[0].Data).toMatchObject({ Id: 455430, AgreementId: 802 })
    expect(vi.mocked(createStockReport).mock.calls[0][0].comparison).toEqual(clientComparisonRequest().comparison)
  })
  it('restores both windows and revision, saves them unchanged, and refuses an invalid later template before mutating the form', async () => {
    const template = { Id: crypto.randomUUID(), Revision: 3, Name: 'Клієнти: липень проти червня', Data: clientComparisonRequest() }
    const invalid = { ...template, Id: crypto.randomUUID(), Name: 'Неповне порівняння', Data: { ...template.Data, comparison: { Version: 1, From: '', To: '' } } }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template, invalid])
    const { container } = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(await screen.findByRole('button', { name: /Клієнти: липень проти червня/ }))
    expect((screen.getByLabelText('Період порівняння: від') as HTMLInputElement).value).toBe('2026-06-01')
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual(template.Data)
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Оновити шаблон' })[0])
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0]).toEqual(template)
    fireEvent.click(screen.getByRole('button', { name: /Неповне порівняння/ }))
    expect(screen.getByText(/Оберіть початок і завершення періоду порівняння/)).toBeTruthy()
    expect((screen.getByLabelText('Період порівняння: від') as HTMLInputElement).value).toBe('2026-06-01')
  })
  it('keeps an omitted IsChecked selected when restoring a source13 template', async () => {
    const data = clientComparisonRequest()
    data.sorted.Measurements = [{ ...data.sorted.Measurements[1] }]
    Reflect.deleteProperty(data.sorted.Measurements[0], 'IsChecked')
    const template = { Id: crypto.randomUUID(), Revision: 1, Name: 'Попередні клієнти', Data: data }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    const { container } = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' }))
    fireEvent.click(await screen.findByRole('button', { name: /Попередні клієнти/ }))
    expect((screen.getByRole('checkbox', { name: CLIENT_COMPARISON_CAPTIONS[1] }) as HTMLInputElement).checked).toBe(true)
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].sorted.Measurements.map(item => item.Type)).toEqual([26])
  })

})
