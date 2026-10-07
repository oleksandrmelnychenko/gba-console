import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readOriginalCashAvailability } from '../api/originalCashAvailabilityApi'
import { availabilityCapabilityFixture, availabilityResultFixture, availabilityPartialFixture, availabilityPoint } from '../data/originalCashAvailability.fixtures'
import { availabilityLabels, availabilityFields, type AvailabilityResult } from '../data/originalCashAvailability'
import { OriginalCashAvailabilityPanel } from './OriginalCashAvailabilityPanel'
vi.mock('../api/originalCashAvailabilityApi', () => ({ readOriginalCashAvailability: vi.fn() }))
const panel = (caller: string | null = 'caller1', permission = true) => <MantineProvider env="test"><I18nProvider><OriginalCashAvailabilityPanel capability={availabilityCapabilityFixture()} callerKey={caller}
  canGenerate={permission} initialDateKon={availabilityPoint} /></I18nProvider></MantineProvider>
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear() })
it('native default sends exact DateKon without axes and renders five server measures with no technical identifiers', async () => {
  vi.mocked(readOriginalCashAvailability).mockImplementation(async request => availabilityResultFixture(request)); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('cell', { name: '75.00' })
  expect(readOriginalCashAvailability).toHaveBeenCalledWith(expect.objectContaining({ DateKon: availabilityPoint, RowDimensions: [], Filters: [], IncludeManagement: false }), expect.any(AbortSignal))
  expect(screen.getAllByRole('columnheader')).toHaveLength(5); expect(screen.getAllByRole('cell').map(v => v.textContent)).toEqual(['100.00', '20.00', '5.00', '10.00', '75.00'])
  for (const text of [availabilityResultFixture().ResultSha256!, 'B'.repeat(32), availabilityResultFixture().Code]) expect(screen.queryByText(text)).toBeNull()
})
it('all four named selectors preserve typed account and exact currency membership while grouping and management are opt-in', async () => {
  vi.mocked(readOriginalCashAvailability).mockImplementation(async request => availabilityResultFixture(request)); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('cell', { name: '75.00' })
  const choices = availabilityResultFixture().Choices
  for (const choice of choices) { fireEvent.click(screen.getByRole('combobox', { name: availabilityLabels[choice.Value.Field] })); fireEvent.click(await screen.findByRole('option', { name: choice.Caption })) }
  fireEvent.click(screen.getByRole('combobox', { name: 'Рядки звіту' })); fireEvent.click(await screen.findByRole('option', { name: availabilityLabels[availabilityFields[2]] }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Додати управлінські суми' })); expect(screen.queryByRole('table')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('cell', { name: '150.00' })
  const request = vi.mocked(readOriginalCashAvailability).mock.calls[1][0]
  expect(request.Filters).toEqual(choices.map(v => v.Value)); expect(request.RowDimensions).toEqual([availabilityFields[2]]); expect(request.IncludeManagement).toBe(true)
  const row = screen.getByRole('cell', { name: 'Наш рахунок' }).closest('tr')!
  expect(within(row).getAllByRole('cell').map(v => v.textContent)).toEqual(['Наш рахунок', '100.00', '20.00', '5.00', '10.00', '75.00', '200.00', '40.00', '10.00', '20.00', '150.00'])
})
it('known partial values render explicitly but cannot export a complete result', async () => {
  vi.mocked(readOriginalCashAvailability).mockResolvedValue(availabilityPartialFixture()); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('cell', { name: '100.00' })
  expect(screen.getAllByRole('cell').map(v => v.textContent)).toEqual(['100.00', 'Недоступно', '5.00', '10.00', 'Недоступно'])
  for (const name of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByRole('cell', { name: '0.00' })).toBeNull()
})
it('changing the editable native point aborts pending read and date ABA cannot accept its late response', async () => {
  let finish!: (result: AvailabilityResult) => void
  vi.mocked(readOriginalCashAvailability).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readOriginalCashAvailability).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readOriginalCashAvailability).mock.calls[0][1], input = screen.getByLabelText('Дата й час залишку') as HTMLInputElement
  expect(input.disabled).toBe(false); fireEvent.change(input, { target: { value: '2026-10-06T12:35:00' } }); expect(signal?.aborted).toBe(true)
  fireEvent.change(input, { target: { value: availabilityPoint } }); await act(async () => { finish(availabilityResultFixture()) })
  expect(screen.queryByRole('table')).toBeNull(); expect((screen.getByRole('combobox', { name: availabilityLabels[availabilityFields[2]] }) as HTMLInputElement).disabled).toBe(true)
})
it('caller ABA clears named options selection rows and export controls without reusing previous caller scope', async () => {
  vi.mocked(readOriginalCashAvailability).mockImplementation(async request => availabilityResultFixture(request)); const view = render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('cell', { name: '75.00' })
  fireEvent.click(screen.getByRole('combobox', { name: availabilityLabels[availabilityFields[2]] })); fireEvent.click(await screen.findByRole('option', { name: 'Наш рахунок' }))
  view.rerender(panel('caller2')); view.rerender(panel('caller1'))
  expect(screen.queryByText('Наш рахунок', { selector: '.mantine-Pill-label' })).toBeNull(); expect(screen.queryByRole('table')).toBeNull()
  expect((screen.getByRole('combobox', { name: availabilityLabels[availabilityFields[2]] }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readOriginalCashAvailability).toHaveBeenCalledTimes(2)); expect(vi.mocked(readOriginalCashAvailability).mock.calls[1][0].Filters).toEqual([])
})
it('permission loss aborts pending read and late completion never restores result or named choices', async () => {
  let finish!: (result: AvailabilityResult) => void; vi.mocked(readOriginalCashAvailability).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readOriginalCashAvailability).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readOriginalCashAvailability).mock.calls[0][1]; view.rerender(panel('caller1', false)); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(availabilityResultFixture()) }); expect(screen.queryByRole('table')).toBeNull(); expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
})
it('optional management change clears previous table before generating and never makes unknown management zero', async () => {
  vi.mocked(readOriginalCashAvailability).mockImplementation(async request => availabilityResultFixture(request)); render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('cell', { name: '75.00' })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Додати управлінські суми' })); expect(screen.queryByRole('table')).toBeNull()
  const base = availabilityResultFixture()
  vi.mocked(readOriginalCashAvailability).mockImplementation(async value => ({ ...base, ...value, Available: false, Code: 'original_cash_availability_inputs_incomplete', ManagementCurrencyId: null, ManagementCurrencySourceReference: null, ManagementCurrency: null,
    Rows: [{ ...base.Rows[0], Management: { Current: null, Writeoff: null, Receipts: null, Reserve: null, Free: null } }], ManagementTotals: { ...base.ManagementTotals!, Amounts: { Current: null, Writeoff: null, Receipts: null, Reserve: null, Free: null } },
    Table: { Columns: availabilityResultFixture(value).Table.Columns, Rows: [['100.00', '20.00', '5.00', '10.00', '75.00', null, null, null, null, null]] } }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(screen.getAllByRole('cell')).toHaveLength(10))
  expect(screen.getAllByRole('cell').slice(5).map(v => v.textContent)).toEqual(Array(5).fill('Недоступно'))
})
it('invalid exact native point does not send request or silently adapt an end date', () => {
  render(panel()); fireEvent.change(screen.getByLabelText('Дата й час залишку'), { target: { value: '' } }); expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  expect(readOriginalCashAvailability).not.toHaveBeenCalled()
})

it('unavailable selected membership retains the genuine caption for clearing without fabricating an empty zero result', async () => {
  vi.mocked(readOriginalCashAvailability).mockImplementation(async request => availabilityResultFixture(request)); render(panel())
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('cell', { name: '75.00' })
  fireEvent.click(screen.getByRole('combobox', { name: availabilityLabels[availabilityFields[2]] })); fireEvent.click(await screen.findByRole('option', { name: 'Наш рахунок' }))
  vi.mocked(readOriginalCashAvailability).mockImplementationOnce(async request => ({ ...availabilityResultFixture(request), Available: false, Code: 'original_cash_availability_filter_membership_unavailable', NormalInputsComplete: false,
    Rows: [], Choices: [], ResultSha256: null, OwnTotals: null, ManagementTotals: null, Table: { Columns: [], Rows: [] } }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(false))
  expect(screen.getByText('Наш рахунок', { selector: '.mantine-Pill-label' })).toBeTruthy(); expect(screen.queryByRole('table')).toBeNull()
  fireEvent.click(screen.getByLabelText(`Очистити ${availabilityLabels[availabilityFields[2]]}`, { selector: 'button' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readOriginalCashAvailability).toHaveBeenCalledTimes(3)); expect(vi.mocked(readOriginalCashAvailability).mock.calls[2][0].Filters).toEqual([])
})
