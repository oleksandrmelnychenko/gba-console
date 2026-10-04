import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readOriginalCashStatement } from '../api/originalCashStatementApi'
import { cashCapabilityFixture, cashResultFixture } from '../data/originalCashStatement.fixtures'
import { cashLabels } from '../data/originalCashStatement'
import { OriginalCashStatementPanel } from './OriginalCashStatementPanel'
vi.mock('../api/originalCashStatementApi', () => ({ readOriginalCashStatement: vi.fn() }))
const panel = (caller = 'caller1', allowed = true) => <MantineProvider env="test"><I18nProvider><OriginalCashStatementPanel capability={cashCapabilityFixture()} callerKey={caller}
  canGenerate={allowed} initialFrom="2026-09-01" initialThrough="2026-09-30" /></I18nProvider></MantineProvider>
it('offers all four genuine typed filters and sends account currency selection without changing resource units', async () => {
  vi.clearAllMocks(); vi.mocked(readOriginalCashStatement).mockImplementation(async request => ({ ...cashResultFixture(), Filters: request.Filters, IncludeTurnover: request.IncludeTurnover }))
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: cashLabels.BankAccountCash }) as HTMLInputElement).disabled).toBe(false))
  for (const choice of cashResultFixture().Choices) {
    fireEvent.click(screen.getByRole('combobox', { name: cashLabels[choice.Value.Field] })); fireEvent.click(await screen.findByRole('option', { name: choice.Caption }))
  }
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readOriginalCashStatement).toHaveBeenCalledTimes(2))
  expect(vi.mocked(readOriginalCashStatement).mock.calls[1][0].Filters).toEqual(cashResultFixture().Choices.map(choice => choice.Value))
  expect(vi.mocked(readOriginalCashStatement).mock.calls[1][0].IncludeTurnover).toBe(false)
  expect(screen.queryByText('B'.repeat(32))).toBeNull(); expect(screen.queryByText('E'.repeat(32))).toBeNull()
})
it('complete empty response preserves selected caption and clear action sends no hidden typed filter', async () => {
  vi.clearAllMocks(); const first = cashResultFixture(), empty = { ...first, Rows: [], Totals: null, Choices: [], ResultSha256: 'e'.repeat(64) }
  vi.mocked(readOriginalCashStatement).mockImplementation(async request => ({ ...(vi.mocked(readOriginalCashStatement).mock.calls.length === 1 ? first : empty), Filters: request.Filters, IncludeTurnover: request.IncludeTurnover }))
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: cashLabels.CashCurrency }) as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('combobox', { name: cashLabels.CashCurrency })); fireEvent.click(await screen.findByRole('option', { name: 'Злотий' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('У повністю перевіреному періоді рядків немає.')
  expect(screen.getByText('Злотий', { selector: '.mantine-MultiSelect-pill .mantine-Pill-label' })).toBeTruthy()
  expect((screen.getByRole('combobox', { name: cashLabels.CashCurrency }) as HTMLInputElement).disabled).toBe(false)
  fireEvent.click(screen.getByLabelText(`Очистити ${cashLabels.CashCurrency}`, { selector: 'button' }))
  expect(screen.queryByText('Злотий', { selector: '.mantine-MultiSelect-pill .mantine-Pill-label' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readOriginalCashStatement).toHaveBeenCalledTimes(3))
  expect(vi.mocked(readOriginalCashStatement).mock.calls[1][0].Filters).toEqual([first.Choices[2].Value]); expect(vi.mocked(readOriginalCashStatement).mock.calls[2][0].Filters).toEqual([])
})
it('caller change aborts old request and no stale choices rows or exports survive', async () => {
  vi.clearAllMocks(); let finish!: (value: ReturnType<typeof cashResultFixture>) => void
  vi.mocked(readOriginalCashStatement).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readOriginalCashStatement).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readOriginalCashStatement).mock.calls[0][1]; view.rerender(panel('caller2')); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(cashResultFixture()) }); expect(screen.queryByText('Наш рахунок')).toBeNull()
  for (const name of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
})
it('missing normal month or currency property keeps every export unavailable without manufactured money', async () => {
  vi.clearAllMocks(); const result = cashResultFixture()
  vi.mocked(readOriginalCashStatement).mockResolvedValue({ ...result, Available: false, Code: 'original_cash_statement_currency_attribute_unavailable', Rows: [], Totals: null, Choices: [],
    InputWitnessSha256: null, ResultSha256: null, CurrencyAttributeScopeComplete: false })
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('Для всіх відібраних рахунків ще не синхронізовані точні реквізити валюти. Відбір не застосовується частково.')
  for (const name of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByText('Наш рахунок')).toBeNull()
})
it('optional turnover changes only requested presentation mode and invalidates preceding exports', async () => {
  vi.clearAllMocks(); vi.mocked(readOriginalCashStatement).mockImplementation(async request => ({ ...cashResultFixture(), Filters: request.Filters, IncludeTurnover: request.IncludeTurnover }))
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByText('9007199254740990.97', { selector: 'tbody td' })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Додати обороти' }))
  for (const name of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readOriginalCashStatement).toHaveBeenCalledTimes(2))
  expect(vi.mocked(readOriginalCashStatement).mock.calls[1][0].IncludeTurnover).toBe(true)
})
it('permission loss prevents request and removes current financial screen and export access', async () => {
  vi.clearAllMocks(); const view = render(panel('caller1', false)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); expect(readOriginalCashStatement).not.toHaveBeenCalled()
  view.rerender(panel('caller1', true)); expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false)
})
