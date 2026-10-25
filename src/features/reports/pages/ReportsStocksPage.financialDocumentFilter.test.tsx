import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { profitDayDataset } from '../data/profitReadMode.test-fixtures'
import { documentFilterCapability } from '../data/currentFinancialDocumentFilter.test-fixtures'
import { searchCurrentFinancialDocuments } from '../api/currentFinancialDocumentLookup'
import { useState } from 'react'
import type { ReportSelection } from '../types'
import { ReportsStocksPage, SelectionValuePicker } from './ReportsStocksPage'
import { WORKBOOK_FILES } from '../testing/workbookFiles'
import { changeReportPeriod } from '../testing/reportPeriod'
import { findOpenedWorkbook } from '../testing/workbookDesk'

vi.mock('../reportSurfacePolicy', () => ({ BUG_1274_ONLY_REPORT_SURFACE: true }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true, user: { NetUid: 'financial-filter-test' } }) }))
vi.mock('../api/currentFinancialDocumentLookup', () => ({ searchCurrentFinancialDocuments: vi.fn() }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([])
  vi.mocked(searchCurrentFinancialDocuments).mockResolvedValue([{ Id: 'sale:9007199254740993', Name: 'Продаж однаковий', documentRef: { kind: 'sale', id: '9007199254740993' } }, { Id: 'return:9007199254740993', Name: 'Повернення однакове', documentRef: { kind: 'return', id: '9007199254740993' } }])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/filter.xlsx' }, raw: {} })
})
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear() })
function dataset(admitted: boolean) {
  return { ...profitDayDataset, profitReadModeLookup: undefined,
    Filters: profitDayDataset.Filters.map(field => ({ ...field, Name: field.Type === 1 ? 'Товар' : field.Name })),
    currentFinancialDocumentFilter: admitted ? documentFilterCapability : undefined }
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
  fireEvent.click(within(dialog).getByRole('combobox', { name: 'Поле' }));fireEvent.click(screen.getByRole('option', { name: 'Документ' }))
  return { ...view, dialog }
}
it('does not offer document filtering when the optional capability is absent', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, dataset(false)])
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await findOpenedWorkbook('ВП.xls')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', false))
  const filters = screen.getByRole('group', { name: 'Фільтри' })
  fireEvent.click(within(filters).getByRole('button', { name: 'Додати умову' }))
  fireEvent.click(within(filters).getByRole('combobox', { name: 'Поле' }))
  expect(screen.queryByRole('option', { name: 'Документ' })).toBeNull()
  expect(searchCurrentFinancialDocuments).not.toHaveBeenCalled()
})
it('submits own return reference, preserves it after date changes, and blocks historical mode without silently clearing it', async () => {
  const view = await editor(true)
  fireEvent.click(within(view.dialog).getByRole('combobox', { name: 'Умова' }))
  for (const name of ['Дорівнює', 'Не дорівнює', 'У списку', 'Не у списку']) expect(screen.getByRole('option', { name })).toBeTruthy()
  fireEvent.click(screen.getByRole('option', { name: 'Не дорівнює' }))
  await waitFor(() => expect(searchCurrentFinancialDocuments).toHaveBeenLastCalledWith('2026-10-17', '2026-10-23', expect.any(Object), expect.any(AbortSignal)))
  await waitFor(() => expect(view.dialog.querySelector('.mantine-Loader-root')).toBeNull())
  fireEvent.click(within(view.dialog).getByRole('combobox', { name: 'Значення' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Повернення однакове' }))
  expect(within(view.dialog).getByRole('button', { name: 'Зберегти' })).toHaveProperty('disabled', false)
  fireEvent.click(within(view.dialog).getByRole('button', { name: 'Зберегти' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Додати умову відбору' })).toBeNull())
  expect(screen.getByText('Повернення однакове')).toBeTruthy()
  await waitFor(() => {
    const key = Object.keys(sessionStorage).find(item => item.startsWith('report-workspace-draft:v1:'))
    expect(key).toBeTruthy()
    const draft = JSON.parse(sessionStorage.getItem(key!)!)
    expect(draft.snapshot.data.selections[0].Values[0].Data).toEqual({ kind: 'return', id: '9007199254740993' })
  })
  changeReportPeriod({ from: '2026-10-18', to: '2026-10-23' })
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!) })
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(1))
  const before = vi.mocked(createStockReport).mock.calls[0][0]
  expect(before.selections, JSON.stringify(before)).toHaveLength(1)
  expect(before.selections[0]).toEqual({ IsChecked: true, SelectedField: { Type: 12, Name: 'SaleDocument' }, FilterCondition: { Type: 1, Name: 'Не дорівнює' },
    Values: [{ Data: { kind: 'return', id: '9007199254740993' }, Name: 'Повернення однакове', Value: 0 }] })
  fireEvent.click(screen.getByRole('combobox', { name: 'Джерело розрахунку' }))
  fireEvent.click(screen.getByRole('option', { name: 'Збережені регістри 1С' }))
  expect(screen.getByRole('button', { name: 'Сформувати' })).toHaveProperty('disabled', true)
  expect(screen.getByRole('button', { name: 'Сформувати' }).getAttribute('title')).toContain('Відбір за документом доступний лише')
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!) })
  expect(createStockReport).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('combobox', { name: 'Джерело розрахунку' }))
  fireEvent.click(screen.getByRole('option', { name: 'Поточні документи GBA' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Сформувати' })).toHaveProperty('disabled', false))
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!) })
  await waitFor(() => expect(createStockReport).toHaveBeenCalledTimes(2))
  expect(vi.mocked(createStockReport).mock.calls[1][0]).toEqual(before)
})
it('offers the document and all four conditions in the actual workbook inline editor', async () => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, dataset(true)])
  render(<MantineProvider env="test"><I18nProvider><ReportsStocksPage /></I18nProvider></MantineProvider>)
  await findOpenedWorkbook('ВП.xls')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Застосувати й показати' })).toHaveProperty('disabled', false))
  const filters = screen.getByRole('group', { name: 'Фільтри' })
  fireEvent.click(within(filters).getByRole('button', { name: 'Додати умову' }))
  fireEvent.click(within(filters).getByRole('combobox', { name: 'Поле' }))
  fireEvent.click(screen.getByRole('option', { name: 'Документ' }))
  fireEvent.click(within(filters).getByRole('combobox', { name: 'Умова' }))
  for (const name of ['Дорівнює', 'Не дорівнює', 'У списку', 'Не у списку']) expect(screen.getByRole('option', { name })).toBeTruthy()
  fireEvent.click(screen.getByRole('option', { name: 'Не у списку' }))
  await waitFor(() => expect(searchCurrentFinancialDocuments).toHaveBeenCalled())
  expect(vi.mocked(searchCurrentFinancialDocuments).mock.calls.every(([from, to]) => /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to))).toBe(true)
})

it('keeps sale and return with the same large ID separate in the actual multi picker and retains chips across period changes', async () => {
  const captured = vi.fn()
  function Picker() {
    const [selection, setSelection] = useState<ReportSelection>({ IsChecked: true, SelectedField: { Type: 12, Name: 'SaleDocument' },
      FilterCondition: { Type: 4, Name: 'Не у списку' }, Values: [{ Data: { kind: 'sale', id: '9007199254740993' }, Name: 'Продаж однаковий', Value: 0 }] })
    const [from, setFrom] = useState('2026-10-16')
    return <><button onClick={() => setFrom('2026-10-17')}>Наступний день</button><SelectionValuePicker dataSource={35} lookupProfitReadMode={0}
      from={from} to="2026-10-20" label="Документи" selection={selection} selections={[selection]}
      onChange={Values => { captured(Values); setSelection({ ...selection, Values }) }} /></>
  }
  render(<MantineProvider env="test"><I18nProvider><Picker /></I18nProvider></MantineProvider>)
  fireEvent.click(screen.getByRole('combobox', { name: 'Документи' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Повернення однакове' }))
  await waitFor(() => expect(captured).toHaveBeenCalled())
  expect(captured.mock.lastCall?.[0].map((v: { Data: unknown }) => v.Data)).toEqual([
    { kind: 'sale', id: '9007199254740993' }, { kind: 'return', id: '9007199254740993' },
  ])
  fireEvent.click(screen.getByRole('button', { name: 'Наступний день' }))
  await waitFor(() => expect(searchCurrentFinancialDocuments).toHaveBeenCalledWith('2026-10-17', '2026-10-20', expect.any(Object), expect.any(AbortSignal)))
  expect(screen.getByText('Продаж однаковий', { exact: true })).toBeTruthy()
  expect(screen.getByText('Повернення однакове', { exact: true })).toBeTruthy()
  expect(captured).toHaveBeenCalledTimes(1)
})
