import type { ReportRequestBody } from '../types'
import { mixedDataset } from '../data/currentVparivanieAnalysis.group-selection.test-fixtures'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { searchAnalysisValues } from '../api/currentVparivanieAnalysisApi'
import { currentVparivanieAnalysisCapability } from '../data/currentVparivanieAnalysis'
import { analysisDataset } from '../data/currentVparivanieAnalysis.test-fixtures'
import { currentVparivanieRequest } from '../data/currentVparivanie.test-fixtures'
import { ReportsStocksPage } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
vi.mock('../api/currentVparivanieAnalysisApi', () => ({ searchAnalysisValues: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([analysisDataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: 'old', Revision: 1, Name: 'Збережена матриця', Data: currentVparivanieRequest() }])
  vi.mocked(createStockReport).mockResolvedValue({ document: {}, raw: {} })
  vi.mocked(searchAnalysisValues).mockResolvedValue([{ id: 'top:A', name: 'A', data: { value: 'A' } }])
})
async function open() {
  const result = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Шаблони' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Відкрити для редагування: Збережена матриця' }))
  await screen.findByRole('button', { name: 'Додати поле: Групування рядків' })
  return result
}
it('upgrades a legacy UI template to all-sales analysis and adds a categorized time dimension', async () => {
  const { container } = await open()
  expect(screen.queryByRole('button', { name: 'Видалити Показник' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Додати поле: Групування рядків' }))
  const picker = screen.getByRole('dialog', { name: 'Групування рядків' })
  expect(within(picker).getByRole('button', { name: 'Період' })).toBeTruthy()
  fireEvent.change(within(picker).getByLabelText('Пошук поля'), { target: { value: 'місяць' } })
  fireEvent.click(within(picker).getByRole('button', { name: 'Місяць' }))
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  const request = vi.mocked(createStockReport).mock.calls[0][0]
  expect(request).toMatchObject({ currentVparivanieAnalysis: { version: 1 }, currentVparivanieFullScope: true })
  expect(request.sorted.Row.map(f => f.type)).toEqual([6, 5, 2])
  expect(request.sorted.Col.map(f => f.type)).toEqual([74, 75])
})
it('selects Top from the Product category and transports its exact text classification', async () => {
  const { container } = await open()
  fireEvent.click(screen.getByRole('button', { name: 'Додати умову' }))
  const editor = screen.getByRole('dialog', { name: 'Додати умову відбору' })
  fireEvent.click(within(editor).getByRole('button', { name: 'Оберіть поле' }))
  const picker = screen.getByRole('dialog', { name: 'Поле відбору' })
  const unavailable = currentVparivanieAnalysisCapability(analysisDataset)!.filters.find(f => f.type === 15)!
  expect(within(picker).getByText(unavailable.name).closest('button')?.disabled).toBe(true)
  expect(within(picker).getByText(unavailable.unavailabilityReason!)).toBeTruthy()
  fireEvent.click(within(picker).getByRole('button', { name: 'Топ' }))
  await waitFor(() => expect(searchAnalysisValues).toHaveBeenLastCalledWith(3, '', '2026-09-01', '2026-09-27', undefined, expect.any(AbortSignal)))
  fireEvent.click(within(editor).getByRole('combobox', { name: 'Значення' }))
  fireEvent.click(await screen.findByRole('option', { name: 'A' }))
  await waitFor(() => expect(within(editor).getByRole('button', { name: 'Зберегти' }).hasAttribute('disabled')).toBe(false))
  fireEvent.click(within(editor).getByRole('button', { name: 'Зберегти' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Додати умову відбору' })).toBeNull())
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0].selections.find(s => s.SelectedField.Type === 3)).toMatchObject({
    SelectedField: { Type: 3 }, FilterCondition: { Type: 0 }, Values: [{ Data: { value: 'A' }, Name: 'A', Value: 0 }],
  })
})

it('preserves restored mixed selections on many-to-one changes and saves only after an explicit correction', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([mixedDataset])
  const request: ReportRequestBody = currentVparivanieRequest()
  request.selections = [{ IsChecked: true, SelectedField: { Type: 4, Name: 'Товарна група' }, FilterCondition: { Type: 3, Name: 'У групі зі списку' },
    Values: [{ Data: { kind: 'productGroup', id: 1 }, Name: 'Group one', Value: 0 }, { Data: { kind: 'productGroup', id: 2 }, Name: 'Group two', Value: 0 }] }]
  vi.mocked(getServerReportTemplates).mockResolvedValue([{ Id: 'old', Revision: 1, Name: 'Збережена матриця', Data: request }])
  vi.mocked(searchAnalysisValues).mockResolvedValue([
    { id: '1', name: 'Group one', data: { Id: 1 } },
    { id: '2', name: 'Group two', data: { Id: 2 } },
  ])
  const { container } = await open()
  fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))
  const editor = screen.getByRole('dialog', { name: 'Редагувати умову відбору' })
  expect(within(editor).getByText('Група: Group one')).toBeTruthy()
  expect(within(editor).getByText('Група: Group two')).toBeTruthy()
  fireEvent.click(within(editor).getByRole('combobox', { name: 'Умова' }))
  fireEvent.click(await screen.findByRole('option', { name: 'У групі' }))
  expect(within(editor).getByText('Група: Group one')).toBeTruthy()
  expect(within(editor).getByText('Група: Group two')).toBeTruthy()
  expect(within(editor).getByText('Оберіть одну групу для цієї умови.')).toBeTruthy()
  expect(within(editor).getByRole('button', { name: 'Зберегти' }).hasAttribute('disabled')).toBe(true)
  expect(within(editor).queryByRole('radio', { name: 'Товари' })).toBeNull()
  fireEvent.click(within(editor).getByRole('combobox', { name: 'Значення' }))
  await waitFor(() => {
    const option = within(editor).getByRole('option', { name: 'Group two' })
    expect(option.isConnected).toBe(true)
    fireEvent.click(option)
    expect(within(editor).queryByText('Група: Group one')).toBeNull()
  })
  fireEvent.click(within(editor).getByRole('button', { name: 'Зберегти' }))
  fireEvent.submit(container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0].selections.find(s => s.SelectedField.Type === 4)).toMatchObject({
    FilterCondition: { Type: 6 }, Values: [{ Data: { Id: 2 }, Name: 'Group two', Value: 0 }],
  })
})
