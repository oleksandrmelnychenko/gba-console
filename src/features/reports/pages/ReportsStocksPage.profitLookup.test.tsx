import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createStockReport, searchDatasetReportValues } from '../api/reportsApi'
import { getReportDatasets, getServerReportTemplates } from '../api/reportWorkspaceApi'
import { reportDatasets } from '../data/reportDatasets.test-fixtures'
import { profitSupplierDataset } from '../data/profitReadMode.test-fixtures'
import type { ReportEntity, ReportSelection } from '../types'
import { ReportsStocksPage, SelectionValuePicker } from './ReportsStocksPage'
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true, user: { NetUid: 'profit-lookup-owner' } }) }))
vi.mock('../api/reportsApi', async original => ({ ...await original<typeof import('../api/reportsApi')>(), createStockReport: vi.fn(), searchDatasetReportValues: vi.fn() }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn(), getServerReportTemplates: vi.fn() }))
const dataset = { ...profitSupplierDataset, profitReadModeLookup: true, Filters: [0, 1, 17].map(Type => ({ Type, Name: ({ 0: 'Організація', 1: 'Товар', 17: 'Постачальник' })[Type]! })) }
const selection: ReportSelection = { IsChecked: true, SelectedField: { Type: 1, Name: 'Product' }, FilterCondition: { Type: 0, Name: 'Equals' }, Values: [] }
const provider = (children: ReactNode) => <MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider>
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, dataset])
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(searchDatasetReportValues).mockResolvedValue([{ Id: '9223372036854775807', Name: 'Новий товар GBA' }])
  vi.mocked(createStockReport).mockResolvedValue({ document: { DocumentURL: '/files/current.xlsx' }, raw: {} })
})
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear() })
async function editor(mode?: string) {
  const view = render(provider(<ReportsStocksPage consoleScope={false} />))
  await screen.findByRole('button', { name: 'Продажі за днями' })
  fireEvent.click(screen.getByText('Часткові форми за зразками Excel'))
  fireEvent.click(screen.getByRole('button', { name: 'Відкрити часткову форму: Валовий прибуток за постачальниками' }))
  if (mode) {
    fireEvent.click(screen.getByRole('combobox', { name: 'Джерело розрахунку' }))
    fireEvent.click(screen.getByRole('option', { name: mode }))
  }
  fireEvent.click(screen.getByRole('button', { name: 'Додати умову' }))
  const dialog = await screen.findByRole('dialog', { name: 'Додати умову відбору' })
  fireEvent.click(within(dialog).getByRole('combobox', { name: 'Поле' }))
  fireEvent.click(screen.getByRole('option', { name: 'Товар' }))
  return { ...view, dialog }
}
it('uses the capability through the actual page picker and submits a native Int64 identity unchanged', async () => {
  const view = await editor('Поточні документи GBA')
  await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(38, 1, { limit: 30, offset: 0, value: '' }, expect.any(AbortSignal), undefined, undefined, undefined, 0))
  fireEvent.click(within(view.dialog).getByRole('combobox', { name: 'Значення' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Новий товар GBA' }))
  fireEvent.click(within(view.dialog).getByRole('button', { name: 'Зберегти' }))
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(createStockReport).toHaveBeenCalledOnce())
  expect(vi.mocked(createStockReport).mock.calls[0][0].selections[0].Values[0].Data.Id).toBe('9223372036854775807')
})
it.each([undefined, false, 'true'])('does not fall back to legacy current38 choices when capability is %s', async capability => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, { ...dataset, profitReadModeLookup: capability }])
  const view = await editor('Поточні документи GBA')
  expect(await within(view.dialog).findByRole('status')).toHaveProperty('textContent', expect.stringContaining('Сервер ще не підтримує довідник'))
  expect((within(view.dialog).getByRole('combobox', { name: 'Значення' }) as HTMLInputElement).disabled).toBe(true)
  expect(searchDatasetReportValues).not.toHaveBeenCalled()
})
it.each([undefined, 'Збережені регістри 1С'])('keeps legacy query semantics for %s without lookup capability', async mode => {
  vi.mocked(getReportDatasets).mockResolvedValue([...reportDatasets, { ...dataset, profitReadModeLookup: undefined }])
  await editor(mode)
  await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledWith(38, 1, { limit: 30, offset: 0, value: '' }, expect.any(AbortSignal)))
})
it('clears old scope immediately, aborts it and ignores a delayed response while preserving selected identities', async () => {
  let resolveCurrent!: (rows: ReportEntity[]) => void
  let resolveOriginal!: (rows: ReportEntity[]) => void
  const selected: ReportSelection = { ...selection, Values: [{ Name: 'Вибраний товар', Data: { Id: '9007199254740993', Name: 'Вибраний товар' }, Value: 0 }] }
  vi.mocked(searchDatasetReportValues).mockResolvedValueOnce([{ Id: '1', Name: 'Старий варіант' }])
    .mockImplementationOnce(() => new Promise(resolve => { resolveCurrent = resolve }))
    .mockImplementationOnce(() => new Promise(resolve => { resolveOriginal = resolve }))
  const onChange = vi.fn()
  const picker = (mode: 0 | 1 | undefined, unavailable = false) => provider(<SelectionValuePicker dataSource={38} lookupProfitReadMode={mode}
    lookupProfitUnavailable={unavailable} selection={selected} selections={[selected]} from="2026-10-01" to="2026-10-10" label="Значення" onChange={onChange} />)
  const view = render(picker(undefined))
  fireEvent.click(screen.getByRole('combobox', { name: 'Значення' }))
  expect(await screen.findByRole('option', { name: 'Старий варіант' })).toBeTruthy()
  const legacySignal = vi.mocked(searchDatasetReportValues).mock.calls[0][3]!
  view.rerender(picker(0))
  expect(screen.queryByRole('option', { name: 'Старий варіант' })).toBeNull()
  await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledTimes(2))
  expect(legacySignal.aborted).toBe(true)
  const currentSignal = vi.mocked(searchDatasetReportValues).mock.calls[1][3]!
  view.rerender(picker(1))
  await waitFor(() => expect(searchDatasetReportValues).toHaveBeenCalledTimes(3))
  expect(currentSignal.aborted).toBe(true)
  expect(vi.mocked(searchDatasetReportValues).mock.calls[2][7]).toBe(1)
  await act(async () => resolveCurrent([{ Id: '2', Name: 'Запізнілий GBA' }]))
  expect(screen.queryByRole('option', { name: 'Запізнілий GBA' })).toBeNull()
  await act(async () => resolveOriginal([{ Id: '3', Name: 'Актуальний 1С' }]))
  expect(await screen.findByRole('option', { name: 'Актуальний 1С' })).toBeTruthy()
  expect(screen.getAllByText('Вибраний товар').length).toBeGreaterThan(0)
  view.rerender(picker(undefined, true))
  expect(screen.queryByRole('option', { name: 'Актуальний 1С' })).toBeNull()
  expect(view.container.querySelector('.reports-stocks-selected-value')?.textContent).toBe('Вибраний товар')
  expect(onChange).not.toHaveBeenCalled()
  expect(searchDatasetReportValues).toHaveBeenCalledTimes(3)
})
