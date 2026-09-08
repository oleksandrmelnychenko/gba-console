import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, getReportClientAgreements, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { clientActivityDataset, clientActivityRequest } from '../data/clientActivity.test-fixtures'
import { CLIENT_ACTIVITY_COUNT_CAPTION } from '../data/clientActivityReport'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { reportDatasets, valuationDataset } from '../data/reportDatasets.test-fixtures'
import { accountBalanceDataset } from '../data/accountBalances.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), getReportClientAgreements: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
async function ready() { const view = render(<Providers><ReportsStocksPage /></Providers>); await screen.findByRole('button', { name: 'Продажі за днями' }); return view }
async function choose(name: string) { fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' })); fireEvent.click(await screen.findByRole('option', { name })) }

describe('native distinct sale-client constructor', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, valuationDataset, accountBalanceDataset, clientActivityDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
    vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: 4 }))
  })
  it('restores explicit period after current-state source, selects count25 only, and never offers additive transformations or valuation', async () => {
    const { container } = await ready()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-06-01' } }); fireEvent.change(screen.getByLabelText('До'), { target: { value: '2026-07-31' } })
    await choose(valuationDataset.Name); expect(screen.getByRole('combobox', { name: 'Договір для оцінки' })).toBeTruthy()
    await choose(clientActivityDataset.Name)
    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-06-01')
    expect(screen.queryByRole('combobox', { name: 'Договір для оцінки' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: CLIENT_ACTIVITY_COUNT_CAPTION })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Увімкнути TOP/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Увімкнути ABC/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Увімкнути поріг/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Приховати нулі/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Клієнти за місяцями й договорами' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual(defaultDatasetRequest(clientActivityDataset, '2026-06-01', '2026-07-31'))
  })
  it.each(clientActivityDataset.Filters)('uses source12 native literal lookup and the exact Id for filter $Type', async field => {
    const id = field.Type === 9 ? 456246 : 741
    vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: id, AgreementId: 802, Name: `Тест [${id}]` }])
    const user = userEvent.setup(), { container } = await ready(); await choose(clientActivityDataset.Name)
    fireEvent.click(screen.getByRole('button', { name: 'Додати умову' })); const dialog = screen.getByRole('dialog', { name: 'Додати умову відбору' })
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Поле' })); fireEvent.click(await screen.findByRole('option', { name: field.Name }))
    await user.type(within(dialog).getByRole('combobox', { name: 'Значення' }), 'т')
    await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(12, field.Type, { limit: 30, offset: 0, value: 'т' }, expect.any(AbortSignal)))
    expect(getReportClientAgreements).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('option', { name: `Тест [${id}]` })); fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].selections).toMatchObject([{ SelectedField: { Type: field.Type }, Values: [{ Data: { Id: id, AgreementId: 802 }, Value: id }] }])
  })
  it('round-trips private template revision, OR tree, disabled filter, distinct agreement IDs and union ordering intact', async () => {
    const data = clientActivityRequest(), template = { Id: crypto.randomUUID(), Revision: 3, Name: 'Клієнти за двома договорами', Data: data }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template]); const { container } = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(await screen.findByRole('button', { name: /Клієнти за двома договорами/ }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual(data)
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0]).toEqual(template)
  })
  it('refuses incomplete-period saved source12 before changing the current form', async () => {
    const data = { ...clientActivityRequest(), from: '' }
    vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 3, Name: 'Клієнти без періоду', Data: data }]); await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(await screen.findByRole('button', { name: /Клієнти без періоду/ }))
    expect(screen.getByText(/потрібні обидві дати періоду/)).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Набір даних звіту' }) as HTMLInputElement).value).toBe(reportDatasets[0].Name)
    expect(createStockReport).not.toHaveBeenCalled()
  })
})
