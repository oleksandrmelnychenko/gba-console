import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readOriginalPlannedCash } from '../api/originalPlannedCashApi'
import { plannedCapabilityFixture, plannedResultFixture } from '../data/originalPlannedCash.fixtures'
import { OriginalPlannedCashPanel } from './OriginalPlannedCashPanel'
import { plannedDefaultRows } from '../data/originalPlannedCash'
vi.mock('../api/originalPlannedCashApi', () => ({ readOriginalPlannedCash: vi.fn() }))
const response = () => {
  const result = plannedResultFixture()
  return { ...result, Grouping: [...plannedDefaultRows], OriginalDefaultDocumentFieldsAvailable: true, OperationalHeaderWitnessSha256: 'c'.repeat(64),
    Rows: result.Rows.map(row => ({ ...row, Key: plannedDefaultRows.map(Field => ({ Field, Type: Field === 'BankAccountCash' ? '08' : null,
      Table: Field === 'BankAccountCash' ? '00000017' : null, Reference: 'B'.repeat(32), Caption: null })) })) }
}
const panel = (caller = 'caller1') => <MantineProvider env="test"><I18nProvider><OriginalPlannedCashPanel capability={plannedCapabilityFixture()}
  callerKey={caller} canGenerate initialFrom="2026-09-01" initialThrough="2026-09-30" /></I18nProvider></MantineProvider>
it('offers genuine current client captions and sends exact same-world equality without exposing raw IDs', async () => {
  vi.clearAllMocks(); vi.mocked(readOriginalPlannedCash).mockResolvedValue(response())
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Контрагент' }) as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('combobox', { name: 'Контрагент' })); fireEvent.click(await screen.findByRole('option', { name: 'Наш контрагент' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readOriginalPlannedCash).toHaveBeenCalledTimes(2))
  expect(vi.mocked(readOriginalPlannedCash).mock.calls[1][0]).toMatchObject({ Variant: 'receipts', Rows: ['FormOfPayment', 'CashCurrency', 'BankAccountCash', 'PlanningDocument'],
    Filters: [{ Field: 'Counterparty', Type: null, Table: null, Reference: 'A'.repeat(32) }] })
  expect(screen.queryByText('A'.repeat(32))).toBeNull(); expect((screen.getByRole('combobox', { name: 'Форма оплати' }) as HTMLInputElement).disabled).toBe(true)
})
it('period or caller change aborts old response and prevents stale choices rows or exports', async () => {
  vi.clearAllMocks(); let finish!: (value: ReturnType<typeof plannedResultFixture>) => void
  vi.mocked(readOriginalPlannedCash).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readOriginalPlannedCash).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readOriginalPlannedCash).mock.calls[0][1]; view.rerender(panel('caller2')); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(response()) })
  expect(screen.queryByText('Наш контрагент')).toBeNull()
  for (const name of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
})
it('missing own monthly publication keeps rows and every export unavailable', async () => {
  vi.clearAllMocks(); vi.mocked(readOriginalPlannedCash).mockResolvedValue({ ...response(), Available: false,
    Code: 'original_planned_cash_month_publication_unavailable', NormalInputsComplete: false, Rows: [], Choices: [], Totals: null, InputWitnessSha256: null, ResultSha256: null, OperationalHeaderWitnessSha256: null })
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText('Не всі місячні рухи цього періоду повністю синхронізовані.')
  for (const name of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByText('Наш контрагент')).toBeNull()
})

it('complete empty period retains applied human caption until the typed filter is cleared', async () => {
  vi.clearAllMocks(); const empty = { ...response(), Rows: [], Totals: null, Choices: [], ResultSha256: 'e'.repeat(64) }
  vi.mocked(readOriginalPlannedCash).mockResolvedValueOnce(response()).mockResolvedValue(empty)
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Контрагент' }) as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('combobox', { name: 'Контрагент' })); fireEvent.click(await screen.findByRole('option', { name: 'Наш контрагент' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText('У повністю перевіреному періоді рядків немає.')
  expect((screen.getByRole('combobox', { name: 'Контрагент' }) as HTMLInputElement).disabled).toBe(false)
  expect(screen.getByText('Наш контрагент', { selector: '.mantine-MultiSelect-pill .mantine-Pill-label' })).toBeTruthy(); expect(screen.queryByText('A'.repeat(32))).toBeNull()
  fireEvent.click(screen.getByLabelText('Очистити Контрагент', { selector: 'button' }))
  expect(screen.queryByText('Наш контрагент', { selector: '.mantine-MultiSelect-pill .mantine-Pill-label' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readOriginalPlannedCash).toHaveBeenCalledTimes(3))
  expect(vi.mocked(readOriginalPlannedCash).mock.calls[1][0].Filters).toEqual([{ Field: 'Counterparty', Type: null, Table: null, Reference: 'A'.repeat(32) }])
  expect(vi.mocked(readOriginalPlannedCash).mock.calls[2][0].Filters).toEqual([])
})
