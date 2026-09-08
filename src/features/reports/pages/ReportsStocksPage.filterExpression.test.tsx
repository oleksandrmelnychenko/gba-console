import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { expressionDataset, expressionRequest, nestedExpression } from '../data/reportFilterExpression.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'
import { ReportFilterExpressionPanel } from './ReportFilterExpressionPanel'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn() }))
function Providers({ children }: { children: ReactNode }) { return <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider> }
async function select(name: string, option: string) { fireEvent.click(screen.getByRole('combobox', { name })); fireEvent.click(await screen.findByRole('option', { name: option })) }
const saved = () => ({ Id: crypto.randomUUID(), Revision: 3, Name: 'Груповані рахунки', Data: expressionRequest() })
async function ready() { const view = render(<Providers><ReportsStocksPage /></Providers>); await screen.findByRole('button', { name: 'Продажі за днями' }); return view }
async function applySaved() { fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(await screen.findByRole('button', { name: /Груповані рахунки/ })) }

describe('constructor groups of conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, expressionDataset])
    vi.mocked(getServerReportTemplates).mockResolvedValue([])
    vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
    vi.mocked(saveServerReportTemplate).mockImplementation(async template => ({ ...template, Revision: (template.Revision ?? 0) + 1 }))
  })
  it('applies and generates full original selections with disabled foreign contract, exact nested tree and unchanged ordering', async () => {
    const template = saved(); vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    const { container } = await ready(); await applySaved()
    expect(screen.getByText(/№3: CustomerContract.*вимкнено/)).toBeTruthy()
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0]).toEqual(template.Data)
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0]).toEqual(template)
  })
  it('deleting a condition explicitly removes its reference and reconciles later indices before generation', async () => {
    vi.mocked(getServerReportTemplates).mockResolvedValue([saved()])
    const { container } = await ready(); await applySaved()
    const first = screen.getByRole('checkbox', { name: 'Умова відбору 1' }).closest('.reports-stocks-selection-summary')!
    fireEvent.click(within(first as HTMLElement).getByRole('button', { name: 'Видалити' }))
    expect(screen.getByText(/Номери наступних умов узгоджено/)).toBeTruthy()
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    const data = vi.mocked(createStockReport).mock.calls[0][0]
    expect(data.selections.map(selection => selection.SelectedField.Type)).toEqual([30, 9])
    expect(data.filterExpression).toEqual({ Version: 1, Root: { Kind: 1, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 2, Children: [{ Kind: 3, SelectionIndex: 1 }] }] } })
    expect(data.ordering).toEqual(expressionRequest().ordering)
  })
  it('moves a leaf into a later sibling and edits its operator while preserving full template identities', async () => {
    const template = saved(); vi.mocked(getServerReportTemplates).mockResolvedValue([template])
    await ready(); await applySaved()
    await select('Перенести до групи — Умова №2', 'Група 2')
    expect(screen.getByText(/Її значення, прапорці та посилання збережено/)).toBeTruthy()
    await select('Оператор — Група 1', 'І — усі умови')
    fireEvent.click(screen.getByRole('button', { name: 'Шаблони' })); fireEvent.click(screen.getByRole('button', { name: 'Оновити шаблон' }))
    await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledOnce())
    expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0]).toEqual({ ...template, Data: { ...template.Data, filterExpression: { Version: 1, Root: { Kind: 1, Children: [
      { Kind: 1, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 2 }, { Kind: 3, SelectionIndex: 1 }] },
    ] } } } })
  })
  it('keeps the tree through a preset and explicitly clears it on dataset change or reset to legacy AND', async () => {
    vi.mocked(getServerReportTemplates).mockResolvedValue([saved()]); const { container } = await ready(); await applySaved()
    fireEvent.click(screen.getByRole('button', { name: 'Рахунки за призначенням і валютою' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
    expect(vi.mocked(createStockReport).mock.calls[0][0].filterExpression).toEqual(nestedExpression)
    fireEvent.click(screen.getByRole('button', { name: 'Очистити групи: усі умови через І' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
    expect(vi.mocked(createStockReport).mock.calls[1][0].selections).toHaveLength(2)
    expect(vi.mocked(createStockReport).mock.calls[1][0]).not.toHaveProperty('filterExpression')
    fireEvent.click(screen.getByRole('button', { name: 'Налаштувати групи І/АБО' }))
    await select('Набір даних звіту', reportDatasets[0].Name)
    fireEvent.click(screen.getByRole('button', { name: 'Продажі за днями' }))
    fireEvent.submit(container.querySelector('form')!); await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(3))
    expect(vi.mocked(createStockReport).mock.calls[2][0]).not.toHaveProperty('filterExpression')
    expect(vi.mocked(createStockReport).mock.calls[2][0].selections).toEqual([])
  })
  it.each([{ Version: 9, Root: 'future', Extra: true }, { Version: 1, Root: { Kind: 3, SelectionIndex: 0 } }])('refuses invalid imported logic without altering form or template material %#', async filterExpression => {
    const template = { ...saved(), Data: { ...expressionRequest(), filterExpression } }, original = structuredClone(template)
    vi.mocked(getServerReportTemplates).mockResolvedValue([template]); await ready(); await applySaved()
    expect(screen.getByText(/Невідома версія|не включено до логіки/)).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Набір даних звіту' }) as HTMLInputElement).value).toBe(reportDatasets[0].Name)
    expect(template).toEqual(original); expect(createStockReport).not.toHaveBeenCalled(); expect(saveServerReportTemplate).not.toHaveBeenCalled()
  })
  it('blocks an enabled unassigned condition until explicitly added to a group, keeping empty group semantics visible', async () => {
    function Editor() {
      const [expression, setExpression] = useState<unknown>({ Version: 1, Root: { Kind: 2, Children: [] } })
      const data = expressionRequest(); data.selections = [data.selections[0]]
      return <ReportFilterExpressionPanel data={{ ...data, filterExpression: expression }} dataset={expressionDataset} disabled={false} notice={null} onChange={setExpression} />
    }
    render(<Providers><Editor /></Providers>)
    expect(screen.getByText(/Увімкнену умову №1 не включено/)).toBeTruthy()
    expect(screen.getByText('Порожня група не впливає на відбір.')).toBeTruthy()
    await select('Додати умову — Коренева група', '№1: Рахунок Дорівнює Рахунок [1000]')
    expect(screen.queryByText(/Увімкнену умову №1 не включено/)).toBeNull()
    expect((screen.getByRole('combobox', { name: 'Оператор — Коренева група' }) as HTMLInputElement).value).toBe('АБО — будь-яка умова')
    expect(screen.getByRole('region', { name: 'Умова №1' })).toBeTruthy()
  })
})
