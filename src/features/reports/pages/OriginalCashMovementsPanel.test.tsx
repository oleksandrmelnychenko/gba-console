import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readCashMovements } from '../api/originalCashMovementsApi'
import { cashMovementsFilters, cashMovementsLabels, cashMovementsRequestFields, normalizeCashMovements, type CashMovementsRequest, type CashMovementsResult } from '../data/originalCashMovements'
import { cashMovementsXlsx } from '../data/originalCashMovementsExport'
import { cashBank, cashBox, cashMovementsCapability, cashMovementsResponse, emptyCashMovements, unavailableCashMovements } from '../testing/originalCashMovementsFixtures'
import { OriginalCashMovementsPanel } from './OriginalCashMovementsPanel'
vi.mock('../api/originalCashMovementsApi', () => ({ readCashMovements: vi.fn() }))
vi.mock('../data/originalCashMovementsExport', async () => {
  const original = await vi.importActual<typeof import('../data/originalCashMovementsExport')>('../data/originalCashMovementsExport')
  return { ...original, cashMovementsXlsx: vi.fn() }
})
const panel = (caller: string | null = 'caller1', allowed = true) => <MantineProvider env="test"><I18nProvider><OriginalCashMovementsPanel
  capability={cashMovementsCapability} callerKey={caller} canGenerate={allowed} initialFrom="2026-09-10" initialThrough="2026-09-12" /></I18nProvider></MantineProvider>
function echoEmpty(request: CashMovementsRequest, noChoices = false): CashMovementsResult {
  const value = emptyCashMovements(); value.From = request.From; value.Through = request.Through
  for (const field of cashMovementsFilters) { value.Selectors[field] = request[cashMovementsRequestFields[field]]; if (noChoices) value.Choices[field] = [] }
  return normalizeCashMovements(value, request)
}
it('shows all four levels, both exact resources and sparse money-kind cells in the shared grid', async () => {
  vi.clearAllMocks(); vi.mocked(readCashMovements).mockResolvedValue(cashMovementsResponse()); render(panel())
  expect(screen.getAllByRole('combobox')).toHaveLength(8); expect(screen.queryByRole('checkbox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const table = await screen.findByRole('table'), rows = within(table).getAllByRole('row')
  expect(rows).toHaveLength(10)
  expect(within(rows[4]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Не задано', 'Прихід', 'Наша каса', 'Оплата', '0.00', '0.00', '0.00', '0.00', '—', '—'])
  expect(within(rows[8]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Валюта джерела', 'Прихід', 'Наш банк', 'Оплата', '-12.34', '45.67', '—', '—', '-12.34', '45.67'])
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(false)
})
it('every displayed selector sends its exact source key, including NULL and complete compound bank/cash identities', async () => {
  vi.clearAllMocks(); vi.mocked(readCashMovements).mockResolvedValueOnce(cashMovementsResponse()).mockImplementation(async request => echoEmpty(request))
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Валюта коштів' }) as HTMLInputElement).disabled).toBe(false))
  const first = cashMovementsResponse()
  for (const field of cashMovementsFilters) {
    const expected = first.Choices[field][0]
    fireEvent.click(screen.getByRole('combobox', { name: cashMovementsLabels[field] })); fireEvent.click(await screen.findByRole('option', { name: expected.Caption }))
  }
  fireEvent.click(screen.getByRole('combobox', { name: 'Банківський рахунок / каса' })); fireEvent.click(await screen.findByRole('option', { name: 'Наш банк' }))
  expect(screen.queryByRole('table')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readCashMovements).toHaveBeenCalledTimes(2))
  const request = vi.mocked(readCashMovements).mock.calls[1][0]
  for (const field of cashMovementsFilters) expect(request[cashMovementsRequestFields[field]]).toContain(first.Choices[field][0].Key)
  expect(request.Accounts).toEqual([cashBank, cashBox]); expect(request.Currencies).toEqual(['NULL'])
})
it('two money kinds with identical captions retain separate pivot columns and resources', async () => {
  vi.clearAllMocks(); const value = cashMovementsResponse(); value.Columns.forEach(column => { column.Caption = 'Кошти' })
  vi.mocked(readCashMovements).mockResolvedValue(value); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  const table = await screen.findByRole('table'), headers = within(table).getAllByRole('columnheader').filter(header => header.closest('thead'))
  expect(headers.filter(header => header.textContent === 'Кошти · Сумма (оборот)')).toHaveLength(2)
  const row = within(table).getAllByRole('row')[4]
  expect(within(row).getAllByRole('cell').slice(6).map(cell => cell.textContent)).toEqual(['0.00', '0.00', '—', '—'])
})
it('selected keys remain clearable after an empty universe and survive an explicit date change', async () => {
  vi.clearAllMocks(); vi.mocked(readCashMovements).mockResolvedValueOnce(cashMovementsResponse()).mockImplementation(async request => echoEmpty(request, true))
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  fireEvent.click(screen.getByRole('combobox', { name: 'Банківський рахунок / каса' })); fireEvent.click(await screen.findByRole('option', { name: 'Наш банк' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('У повністю перевіреному зрізі рядків немає.')
  expect((screen.getByRole('combobox', { name: 'Банківський рахунок / каса' }) as HTMLInputElement).disabled).toBe(false)
  fireEvent.change(screen.getByLabelText('Кінець періоду'), { target: { value: '2026-09-13' } })
  expect(screen.queryByRole('table')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readCashMovements).toHaveBeenCalledTimes(3)); expect(vi.mocked(readCashMovements).mock.calls[2][0].Accounts).toEqual([cashBank])
  await screen.findByText('У повністю перевіреному зрізі рядків немає.')
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Банківський рахунок / каса' }), { key: 'Backspace' })
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readCashMovements).toHaveBeenCalledTimes(4))
  expect(vi.mocked(readCashMovements).mock.calls[3][0].Accounts).toEqual([])
})
it('unavailable normal month or currency metadata shows no partial table and closes every export', async () => {
  vi.clearAllMocks(); vi.mocked(readCashMovements).mockResolvedValue(unavailableCashMovements()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText(/Для звіту потрібні повні рухи коштів/)
  expect(screen.queryByRole('table')).toBeNull()
  for (const format of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name: format }) as HTMLButtonElement).disabled).toBe(true)
})
it.each(['caller', 'permission'])('changed %s aborts original I/O and refuses late result display', async kind => {
  vi.clearAllMocks(); let complete!: (result: CashMovementsResult) => void
  vi.mocked(readCashMovements).mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readCashMovements).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readCashMovements).mock.calls[0][1]
  view.rerender(kind === 'caller' ? panel('caller2') : panel('caller1', false)); expect(signal?.aborted).toBe(true)
  await act(async () => { complete(cashMovementsResponse()) }); expect(screen.queryByRole('table')).toBeNull()
  expect((screen.getByRole('button', { name: 'CSV' }) as HTMLButtonElement).disabled).toBe(true)
})
it('a deferred workbook cannot download after permission is withdrawn even if the old scope returns', async () => {
  vi.clearAllMocks(); let complete!: (blob: Blob) => void; vi.mocked(cashMovementsXlsx).mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  vi.mocked(readCashMovements).mockResolvedValue(cashMovementsResponse()); const view = render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  fireEvent.click(screen.getByRole('button', { name: 'XLSX' })); await waitFor(() => expect(cashMovementsXlsx).toHaveBeenCalledTimes(1))
  view.rerender(panel('caller1', false)); view.rerender(panel('caller1', true)); await act(async () => { complete(new Blob(['old workbook'])) })
  expect(clicked).not.toHaveBeenCalled(); clicked.mockRestore()
})
it('absent caller and permission denial prevent generation', () => {
  vi.clearAllMocks(); const view = render(panel(null)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(readCashMovements).not.toHaveBeenCalled()
  view.rerender(panel('caller1', false)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(readCashMovements).not.toHaveBeenCalled()
})
