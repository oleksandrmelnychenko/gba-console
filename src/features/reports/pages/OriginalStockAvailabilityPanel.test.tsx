import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readOriginalStockAvailability } from '../api/originalStockAvailabilityApi'
import { stockCapabilityFixture, stockResultFixture } from '../data/originalStockAvailability.fixtures'
import { stockDefaultRows, stockDefaults } from '../data/originalStockAvailability'
import type { StockResult } from '../data/originalStockAvailabilityResponse'
import { OriginalStockAvailabilityPanel } from './OriginalStockAvailabilityPanel'
vi.mock('../api/originalStockAvailabilityApi', () => ({ readOriginalStockAvailability: vi.fn() }))
const panel = (caller = 'callerA', allowed = true) => <MantineProvider env="test"><I18nProvider><OriginalStockAvailabilityPanel capability={stockCapabilityFixture()} callerKey={caller} canGenerate={allowed} initialAt="2026-10-06 12:34:56" /></I18nProvider></MantineProvider>
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); vi.mocked(readOriginalStockAvailability).mockImplementation(async request => stockResultFixture(request)) })
it('default exactDateKon Warehouse then Product six quantities works without optional captions and never displays keys', async () => {
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  const request = vi.mocked(readOriginalStockAvailability).mock.calls[0][0]
  expect(request.At).toBe('2026-10-06 12:34:56'); expect(request.Rows).toEqual(stockDefaultRows); expect(request.Measures).toEqual(stockDefaults)
  expect(screen.getByRole('cell', { name: 'Наш товар' })).toBeTruthy(); expect(screen.queryByText('b'.repeat(64))).toBeNull()
  expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(false)
})
it('named Product filter sends issued opaque key and optional empty selectors never request raw references', async () => {
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  fireEvent.click(screen.getByRole('combobox', { name: 'Номенклатура' })); fireEvent.click(await screen.findByRole('option', { name: 'Наш товар' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  expect(vi.mocked(readOriginalStockAvailability).mock.calls[1][0].Filters).toEqual([{ Field: 'product', Key: 'b'.repeat(64) }])
  expect((screen.getByRole('combobox', { name: 'Якість' }) as HTMLInputElement).disabled).toBe(true); expect(screen.queryByPlaceholderText(/SQL|RRef|32hex/i)).toBeNull()
})
it('unknown selected conversion remains unknown in table and every complete export is disabled', async () => {
  vi.mocked(readOriginalStockAvailability).mockImplementation(async request => {
    const result = stockResultFixture(request)
    if (request.Measures.includes('reportStock')) { result.Available = false; result.Code = 'original_stock_availability_unit_mapping_unavailable'; result.Data[0].Values.reportStock = null }
    return result
  })
  render(panel()); fireEvent.click(screen.getByRole('combobox', { name: 'Показники' })); fireEvent.click(await screen.findByRole('option', { name: 'Залишок · одиниці звітів' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  expect(vi.mocked(readOriginalStockAvailability).mock.calls[0][0].Measures).toEqual([...stockDefaults, 'reportStock'])
  expect(screen.getByRole('cell', { name: 'Недоступно' })).toBeTruthy(); expect(screen.getAllByRole('cell', { name: '10.000' })).toHaveLength(6)
  for (const name of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
})
it('point edits abort original request and dateABA refuses late result without adapting seconds', async () => {
  let finish!: (result: StockResult) => void; vi.mocked(readOriginalStockAvailability).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readOriginalStockAvailability).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readOriginalStockAvailability).mock.calls[0][1], date = screen.getByLabelText('Дата й час залишку') as HTMLInputElement
  expect(date.disabled).toBe(false); fireEvent.change(date, { target: { value: '2026-10-06T12:34:55' } }); expect(signal?.aborted).toBe(true)
  fireEvent.change(date, { target: { value: '2026-10-06T12:34:56' } }); await act(async () => finish(stockResultFixture())); expect(screen.queryByRole('table')).toBeNull()
})
it('callerABA clears named choices and selected filters before next exact default request', async () => {
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  fireEvent.click(screen.getByRole('combobox', { name: 'Номенклатура' })); fireEvent.click(await screen.findByRole('option', { name: 'Наш товар' }))
  view.rerender(panel('callerB')); view.rerender(panel()); expect(screen.queryByRole('table')).toBeNull()
  expect((screen.getByRole('combobox', { name: 'Номенклатура' }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table'); expect(vi.mocked(readOriginalStockAvailability).mock.calls[1][0].Filters).toEqual([])
})
it('permission loss aborts original preview and late rows cannot return after permissionABA', async () => {
  let finish!: (result: StockResult) => void; vi.mocked(readOriginalStockAvailability).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readOriginalStockAvailability).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readOriginalStockAvailability).mock.calls[0][1]; view.rerender(panel('callerA', false)); expect(signal?.aborted).toBe(true)
  await act(async () => finish(stockResultFixture())); view.rerender(panel()); expect(screen.queryByRole('table')).toBeNull()
})
it('invalid plain point disables generation while DateKon form remains editable', () => {
  render(panel()); fireEvent.change(screen.getByLabelText('Дата й час залишку'), { target: { value: '' } })
  expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true); expect(readOriginalStockAvailability).not.toHaveBeenCalled()
})
