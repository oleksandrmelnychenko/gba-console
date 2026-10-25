import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { profitDayDataset } from '../data/profitReadMode.test-fixtures'
import { buyerManagerCapability, managerId, unassignedManagerId } from '../data/currentFinancialBuyerManagerFilter.test-fixtures'
import { searchCurrentFinancialBuyerManagers } from '../api/currentFinancialBuyerManagerLookup'
import { useState } from 'react'
import type { ReportSelection } from '../types'
import { ReportsStocksPage, SelectionValuePicker } from './ReportsStocksPage'
import { WORKBOOK_FILES } from '../testing/workbookFiles'
import { changeReportPeriod } from '../testing/reportPeriod'
import { findOpenedWorkbook } from '../testing/workbookDesk'

vi.mock('../reportSurfacePolicy', () => ({ BUG_1274_ONLY_REPORT_SURFACE: true }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true, user: { NetUid: 'financial-filter-test' } }) }))
vi.mock('../api/currentFinancialBuyerManagerLookup', () => ({ searchCurrentFinancialBuyerManagers: vi.fn() }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(searchCurrentFinancialBuyerManagers).mockResolvedValue([{ Id: managerId, Name: 'Менеджер [42]', buyerManagerRef: { Id: managerId } }, { Id: unassignedManagerId, Name: 'Без основного менеджера покупця', buyerManagerRef: { Id: unassignedManagerId } }])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/filter.xlsx' }, raw: {} })
})
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear() })
function dataset(admitted: boolean) {
  return { ...profitDayDataset, profitReadModeLookup: undefined,
    Filters: profitDayDataset.Filters.map(field => ({ ...field, Name: field.Type === 1 ? 'Товар' : field.Name })),
    currentFinancialBuyerManagerFilter: admitted ? buyerManagerCapability : undefined }
}
async function editor(admitted: boolean) {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, dataset(admitted)])
  const view = render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage consoleScope={false} /></I18nProvider></MantineProvider>)
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByRole('button', { name: `Відкрити ${WORKBOOK_FILES['Валовий прибуток за днем']}` }))
  await waitFor(() => expect(screen.queryByText(/застосовуються відбори книги/i)).toBeNull())
  changeReportPeriod({ from: '2026-10-17', to: '2026-10-23' })
  fireEvent.click(screen.getByRole('button', { name: 'Додати умову' }))
  const dialog = await screen.findByRole('dialog', { name: 'Додати умову відбору' })
  fireEvent.click(within(dialog).getByRole('combobox', { name: 'Поле' }));fireEvent.click(screen.getByRole('option', { name: 'Поточний основний менеджер покупця' }))
  return { ...view, dialog }
}
it('does not offer manager filtering when the optional capability is absent', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, dataset(false)])
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await findOpenedWorkbook('ВП.xls')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', false))
  const filters = screen.getByRole('group', { name: 'Фільтри' })
  fireEvent.click(within(filters).getByRole('button', { name: 'Додати умову' }))
  fireEvent.click(within(filters).getByRole('combobox', { name: 'Поле' }))
  expect(screen.queryByRole('option', { name: 'Поточний основний менеджер покупця' })).toBeNull()
  expect(searchCurrentFinancialBuyerManagers).not.toHaveBeenCalled()
})
it('submits explicit unassigned buyer manager, preserves it after date changes, and blocks historical mode without silently clearing it', async () => {
  const view = await editor(true)
  fireEvent.click(within(view.dialog).getByRole('combobox', { name: 'Умова' }))
  for (const name of ['Дорівнює', 'Не дорівнює', 'У списку', 'Не у списку']) expect(screen.getByRole('option', { name })).toBeTruthy()
  fireEvent.click(screen.getByRole('option', { name: 'Не дорівнює' }))
  await waitFor(() => expect(searchCurrentFinancialBuyerManagers).toHaveBeenLastCalledWith(expect.any(Object), expect.any(AbortSignal)))
  await waitFor(() => expect(view.dialog.querySelector('.mantine-Loader-root')).toBeNull())
  fireEvent.click(within(view.dialog).getByRole('combobox', { name: 'Значення' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Без основного менеджера покупця' }))
  expect(within(view.dialog).getByRole('button', { name: 'Зберегти' })).toHaveProperty('disabled', false)
  fireEvent.click(within(view.dialog).getByRole('button', { name: 'Зберегти' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Додати умову відбору' })).toBeNull())
  expect(screen.getByText('Без основного менеджера покупця')).toBeTruthy()
  await waitFor(() => {
    const key = Object.keys(sessionStorage).find(item => item.startsWith('report-workspace-draft:v1:'))
    expect(key).toBeTruthy()
    const draft = JSON.parse(sessionStorage.getItem(key!)!)
    expect(draft.snapshot.data.selections[0].Values[0].Data).toEqual({ Id: unassignedManagerId })
  })
  changeReportPeriod({ from: '2026-10-18', to: '2026-10-23' })
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!) })
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(1))
  const before = vi.mocked(createStockReport).mock.calls[0][0]
  expect(before.selections, JSON.stringify(before)).toHaveLength(1)
  expect(before.selections[0]).toEqual({ IsChecked: true, SelectedField: { Type: 60, Name: 'SourceBuyerManager' }, FilterCondition: { Type: 1, Name: 'Не дорівнює' },
    Values: [{ Data: { Id: unassignedManagerId }, Name: 'Без основного менеджера покупця', Value: 0 }] })
  fireEvent.click(screen.getByRole('combobox', { name: 'Джерело розрахунку' }))
  fireEvent.click(screen.getByRole('option', { name: 'Збережені регістри 1С' }))
  expect(screen.getByRole('button', { name: 'Сформувати' })).toHaveProperty('disabled', true)
  expect(screen.getByRole('button', { name: 'Сформувати' }).getAttribute('title')).toContain('Відбір за поточним основним менеджером покупця доступний лише')
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!) })
  expect(createStockReport).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('combobox', { name: 'Джерело розрахунку' }))
  fireEvent.click(screen.getByRole('option', { name: 'Поточні документи GBA' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Сформувати' })).toHaveProperty('disabled', false))
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!) })
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
  expect(vi.mocked(createStockReport).mock.calls[1][0]).toEqual(before)
})
it('offers the manager and all four conditions in the actual workbook inline editor', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, dataset(true)])
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await findOpenedWorkbook('ВП.xls')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', false))
  const filters = screen.getByRole('group', { name: 'Фільтри' })
  fireEvent.click(within(filters).getByRole('button', { name: 'Додати умову' }))
  fireEvent.click(within(filters).getByRole('combobox', { name: 'Поле' }))
  fireEvent.click(screen.getByRole('option', { name: 'Поточний основний менеджер покупця' }))
  fireEvent.click(within(filters).getByRole('combobox', { name: 'Умова' }))
  for (const name of ['Дорівнює', 'Не дорівнює', 'У списку', 'Не у списку']) expect(screen.getByRole('option', { name })).toBeTruthy()
  fireEvent.click(screen.getByRole('option', { name: 'Не у списку' }))
  await waitFor(() => expect(searchCurrentFinancialBuyerManagers).toHaveBeenCalled())
  expect(vi.mocked(searchCurrentFinancialBuyerManagers).mock.calls.every(([params]) => !('from' in params) && !('to' in params))).toBe(true)
})

it('keeps assigned and unassigned manager chips distinct across period changes in the actual multi picker', async () => {
  const captured = vi.fn()
  function Picker() {
    const [selection, setSelection] = useState<ReportSelection>({ IsChecked: true, SelectedField: { Type: 60, Name: 'SourceBuyerManager' },
      FilterCondition: { Type: 4, Name: 'Не у списку' }, Values: [{ Data: { Id: managerId }, Name: 'Менеджер [42]', Value: 0 }] })
    const [from, setFrom] = useState('2026-10-16')
    return <><button onClick={() => setFrom('2026-10-17')}>Наступний день</button><SelectionValuePicker dataSource={35} lookupProfitReadMode={0}
      from={from} to="2026-10-20" label="Менеджери" selection={selection} selections={[selection]}
      onChange={Values => { captured(Values); setSelection({ ...selection, Values }) }} /></>
  }
  render(<MantineProvider env="test"><I18nProvider><Picker /></I18nProvider></MantineProvider>)
  fireEvent.click(screen.getByRole('combobox', { name: 'Менеджери' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Без основного менеджера покупця' }))
  await waitFor(() => expect(captured).toHaveBeenCalled())
  expect(captured.mock.lastCall?.[0].map((v: { Data: unknown }) => v.Data)).toEqual([
    { Id: managerId }, { Id: unassignedManagerId },
  ])
  fireEvent.click(screen.getByRole('button', { name: 'Наступний день' }))
  await waitFor(() => expect(searchCurrentFinancialBuyerManagers).toHaveBeenCalledWith(expect.any(Object), expect.any(AbortSignal)))
  expect(screen.getByText('Менеджер [42]', { exact: true })).toBeTruthy()
  expect(screen.getByText('Без основного менеджера покупця', { exact: true })).toBeTruthy()
  expect(captured).toHaveBeenCalledTimes(1)
})

it('keys restored manager chips by identity even when a directory caption changed', async () => {
  const secondId = 'FFEEDDCCBBAA99887766554433221100'
  vi.mocked(searchCurrentFinancialBuyerManagers).mockResolvedValue([
    { Id: managerId, Name: 'Менеджер нова назва [42]', buyerManagerRef: { Id: managerId } },
    { Id: secondId, Name: 'Інший менеджер [43]', buyerManagerRef: { Id: secondId } },
  ])
  const captured = vi.fn()
  function Picker() {
    const [selection, setSelection] = useState<ReportSelection>({ IsChecked: true, SelectedField: { Type: 60, Name: 'SourceBuyerManager' },
      FilterCondition: { Type: 2, Name: 'У списку' }, Values: [{ Data: { Id: managerId }, Name: 'Стара назва [42]', Value: 0 }] })
    return <SelectionValuePicker dataSource={35} lookupProfitReadMode={0} from="2026-10-16" to="2026-10-20"
      label="Менеджери" selection={selection} selections={[selection]}
      onChange={Values => { captured(Values); setSelection({ ...selection, Values }) }} />
  }
  render(<MantineProvider env="test"><I18nProvider><Picker /></I18nProvider></MantineProvider>)
  fireEvent.click(screen.getByRole('combobox', { name: 'Менеджери' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Інший менеджер [43]' }))
  expect(captured.mock.lastCall?.[0]).toEqual([
    { Data: { Id: managerId }, Name: 'Стара назва [42]', Value: 0 },
    { Data: { Id: secondId }, Name: 'Інший менеджер [43]', Value: 0 },
  ])
  expect(screen.getByText('Стара назва [42]', { exact: true })).toBeTruthy()
})
