import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, getReportClientAgreements, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { getNativeReportProfile } from '../data/nativeReportProfiles'
import { reportDatasets, supplierReturnDataset, valuationDataset } from '../data/reportDatasets.test-fixtures'
import { accountBalanceDataset, accountBalanceSelections } from '../data/accountBalances.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), getReportClientAgreements: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
async function ready() { const view = render(<Providers><ReportsStocksPage /></Providers>); await screen.findByRole('button', { name: 'Продажі за днями' }); return view }
async function choose(name: string) { fireEvent.click(screen.getByRole('combobox', { name: 'Набір даних звіту' })); fireEvent.click(await screen.findByRole('option', { name })) }

describe('recorded account balance constructor', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, supplierReturnDataset, valuationDataset, accountBalanceDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
    vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: 2 }))
  })
  it('switches to the current four-axis preset without leaking dates or valuation and restores the period on return', async () => {
    const { container } = await ready()
    fireEvent.change(screen.getByLabelText('Від'), { target: { value: '2026-06-01' } }); fireEvent.change(screen.getByLabelText('До'), { target: { value: '2026-06-30' } })
    await choose(valuationDataset.Name)
    expect(screen.getByRole('combobox', { name: 'Договір для оцінки' })).toBeTruthy()
    await choose(accountBalanceDataset.Name)
    fireEvent.click(screen.getByRole('button', { name: getNativeReportProfile(11)!.preset.name }))
    expect(screen.queryByLabelText('Від')).toBeNull(); expect(screen.queryByRole('combobox', { name: 'Договір для оцінки' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Записаний залишок рахунку' })).toBeTruthy()
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual(defaultDatasetRequest(accountBalanceDataset, '', ''))
    await choose(supplierReturnDataset.Name)
    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('2026-06-01')
    expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe('2026-06-30')
  })
  it.each(accountBalanceDataset.Filters)('uses native one-character lookup and the exact selected Id for field $Type', async field => {
    const id = field.Type === 33 ? 3 : field.Type === 34 ? 2 : 741
    vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: id, Name: `Тест [${id}]` }])
    const user = userEvent.setup(), { container } = await ready(); await choose(accountBalanceDataset.Name)
    fireEvent.click(screen.getByRole('button', { name: 'Додати умову' })); const dialog = screen.getByRole('dialog', { name: 'Додати умову відбору' })
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Поле' })); fireEvent.click(await screen.findByRole('option', { name: field.Name }))
    await user.type(within(dialog).getByRole('combobox', { name: 'Значення' }), 'т')
    await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(11, field.Type, { limit: 30, offset: 0, value: 'т' }, expect.any(AbortSignal)))
    expect(getReportClientAgreements).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('option', { name: `Тест [${id}]` })); fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].selections).toMatchObject([{ SelectedField: { Type: field.Type }, Values: [{ Data: { Id: id }, Value: id }] }])
  })
  it('applies and updates exact payment filters, axis order and a disabled unsupported client contract', async () => {
    const data = { ...defaultDatasetRequest(accountBalanceDataset, '', ''), selections: structuredClone(accountBalanceSelections) }
    const template = { Id: crypto.randomUUID(), Revision: 1, Name: 'Мої записані рахунки', Data: data }
    vi.mocked(getServerReportTemplates).mockResolvedValue([template]); const { container } = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(await screen.findByRole('button', { name: /Мої записані рахунки/ }))
    expect(screen.queryByLabelText('Від')).toBeNull()
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual({ ...data, selections: data.selections.slice(0, 2) })
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0]).toEqual(template)
    await waitFor(() => expect((screen.getByRole('button', { name: 'Зберегти' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledTimes(2))
    const copy = vi.mocked(saveServerReportTemplate).mock.calls[1][0]
    expect(copy.Data).toEqual(data); expect(copy.Id).not.toBe(template.Id); expect(copy.Revision).toBe(0)
  })
  it('refuses a historical account template before changing the current constructor', async () => {
    const data = { ...defaultDatasetRequest(accountBalanceDataset, '', ''), from: '2026-06-01' }
    vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: crypto.randomUUID(), Revision: 1, Name: 'Історичні рахунки', Data: data }]); await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(await screen.findByRole('button', { name: /Історичні рахунки/ }))
    expect(screen.getByText(/Записані залишки рахунків не підтримують період/)).toBeTruthy(); expect(screen.getByLabelText('Від')).toBeTruthy()
    expect(createStockReport).not.toHaveBeenCalled()
  })
})
