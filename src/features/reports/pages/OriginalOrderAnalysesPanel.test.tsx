import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readOriginalOrderAnalyses, readOriginalOrderAnalysisChoices } from '../api/originalOrderAnalysesApi'
import { orderCapabilityFixture, orderChoicesFixture, orderResultFixture } from '../data/originalOrderAnalyses.fixtures'
import { orderAnalysisFieldLabels, type OrderAnalysisKind } from '../data/originalOrderAnalyses'
import type { OrderAnalysisChoices, OrderAnalysisResult } from '../data/originalOrderAnalysisResponse'
import { OriginalOrderAnalysesPanel } from './OriginalOrderAnalysesPanel'
vi.mock('../api/originalOrderAnalysesApi', () => ({ readOriginalOrderAnalyses: vi.fn(), readOriginalOrderAnalysisChoices: vi.fn() }))
const panel = (caller = 'callerA', canGenerate = true, kind: OrderAnalysisKind = 1) => <MantineProvider env="test"><I18nProvider><OriginalOrderAnalysesPanel capability={orderCapabilityFixture(kind)} callerKey={caller} canGenerate={canGenerate} initialFrom="2026-10-01" initialThrough="2026-10-06" /></I18nProvider></MantineProvider>
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear()
  vi.mocked(readOriginalOrderAnalysisChoices).mockImplementation(async request => orderChoicesFixture(request))
  vi.mocked(readOriginalOrderAnalyses).mockImplementation(async request => orderResultFixture(request))
})
it.each([0, 1, 2] as const)('kind %s sends its native default axes measures and exact inclusive dates', async kind => {
  render(panel('callerA', true, kind)); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  const request = vi.mocked(readOriginalOrderAnalyses).mock.calls[0][0], cap = orderCapabilityFixture(kind)
  expect(request.Rows).toEqual(cap.DefaultRows); expect(request.Measures).toEqual(cap.DefaultMeasures); expect(request.From).toBe('2026-10-01'); expect(request.Through).toBe('2026-10-06'); expect(request.Filters).toEqual([])
  expect(request.ShipmentStates).toBeNull(); expect(request.PaymentStates).toBeNull()
  expect(screen.queryByText(cap.Definition.ModuleSha256)).toBeNull(); expect(screen.queryByText('A'.repeat(32))).toBeNull()
})
it('named product selector sends the exact proved reference without raw identifier inputs', async () => {
  render(panel()); await waitFor(() => expect((screen.getByRole('combobox', { name: orderAnalysisFieldLabels[4] }) as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('combobox', { name: orderAnalysisFieldLabels[4] })); fireEvent.click(await screen.findByRole('option', { name: 'Наш товар' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  expect(vi.mocked(readOriginalOrderAnalyses).mock.calls[0][0].Filters).toEqual([{ Field: 4, Value: { Reference: 'A'.repeat(32), Type: null, Table: null } }])
  expect(screen.queryByPlaceholderText(/RRef|32|SQL/i)).toBeNull(); expect((screen.getByRole('combobox', { name: orderAnalysisFieldLabels[7] }) as HTMLInputElement).disabled).toBe(true)
})
it('partial report retains known amounts and observed null but all complete export buttons stay disabled', async () => {
  vi.mocked(readOriginalOrderAnalyses).mockImplementation(async request => {
    const result = orderResultFixture(request), group = result.Groups[0]
    group.Measures[request.Measures[0]] = { Observed: false, Value: null }; group.Measures[request.Measures[1]] = { Observed: true, Value: null }
    return { ...result, Available: false, NormalInputsComplete: false, SelectedNumbersObserved: false }
  })
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  expect(screen.getByRole('cell', { name: 'Недоступно' })).toBeTruthy(); expect(screen.getByRole('cell', { name: 'Немає значення' })).toBeTruthy()
  for (const name of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
})
it('editable inclusive date aborts original pending read and date ABA rejects its late result', async () => {
  let finish!: (result: OrderAnalysisResult) => void
  vi.mocked(readOriginalOrderAnalyses).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readOriginalOrderAnalyses).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readOriginalOrderAnalyses).mock.calls[0][1], date = screen.getByLabelText('Кінець періоду') as HTMLInputElement
  expect(date.disabled).toBe(false); fireEvent.change(date, { target: { value: '2026-10-05' } }); expect(signal?.aborted).toBe(true)
  fireEvent.change(date, { target: { value: '2026-10-06' } }); await act(async () => finish(orderResultFixture()))
  expect(screen.queryByRole('table')).toBeNull()
})
it('caller ABA clears selected named filter and late old choice promise cannot restore its captions', async () => {
  let finish!: (result: OrderAnalysisChoices) => void
  vi.mocked(readOriginalOrderAnalysisChoices).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); await waitFor(() => expect(readOriginalOrderAnalysisChoices).toHaveBeenCalledTimes(1)); const signal = vi.mocked(readOriginalOrderAnalysisChoices).mock.calls[0][1]
  view.rerender(panel('callerB')); view.rerender(panel('callerA')); expect(signal?.aborted).toBe(true)
  await act(async () => { const old = orderChoicesFixture(); old.Choices[0].Caption = 'Стара назва'; finish(old) })
  await waitFor(() => expect((screen.getByRole('combobox', { name: orderAnalysisFieldLabels[4] }) as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('combobox', { name: orderAnalysisFieldLabels[4] })); expect(screen.queryByRole('option', { name: 'Стара назва' })).toBeNull(); fireEvent.click(await screen.findByRole('option', { name: 'Наш товар' }))
  view.rerender(panel('callerB')); view.rerender(panel('callerA')); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  expect(vi.mocked(readOriginalOrderAnalyses).mock.calls[0][0].Filters).toEqual([])
})
it('permission loss aborts pending preview and prevents late rows or exports after permission ABA', async () => {
  let finish!: (result: OrderAnalysisResult) => void
  vi.mocked(readOriginalOrderAnalyses).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await waitFor(() => expect(readOriginalOrderAnalyses).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readOriginalOrderAnalyses).mock.calls[0][1]; view.rerender(panel('callerA', false)); expect(signal?.aborted).toBe(true)
  await act(async () => finish(orderResultFixture())); expect(screen.queryByRole('table')).toBeNull(); expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
  view.rerender(panel()); expect(screen.queryByRole('table')).toBeNull()
})
it('enabled empty shipment filter is sent as empty without inventing a state and invalid period refuses', async () => {
  let finishChoices!: (result: OrderAnalysisChoices) => void
  vi.mocked(readOriginalOrderAnalysisChoices).mockImplementationOnce(() => new Promise(resolve => { finishChoices = resolve }))
  render(panel()); await waitFor(() => expect(readOriginalOrderAnalysisChoices).toHaveBeenCalledTimes(1))
  const shipment = screen.getByRole('checkbox', { name: 'Відбір за відвантаженням' }) as HTMLInputElement
  expect(shipment.disabled).toBe(false); fireEvent.click(shipment); expect(shipment.checked).toBe(true)
  const clear = screen.getByRole('button', { name: 'Очистити вибрані стани · Відбір за відвантаженням' }) as HTMLButtonElement
  expect(clear.disabled).toBe(false)
  await act(async () => finishChoices(orderChoicesFixture()))
  expect(shipment.checked).toBe(true); expect(clear.disabled).toBe(false)
  fireEvent.click(clear); expect(shipment.checked).toBe(true); expect(clear.disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' })); await screen.findByRole('table')
  expect(vi.mocked(readOriginalOrderAnalyses).mock.calls[0][0].ShipmentStates).toEqual([])
  fireEvent.change(screen.getByLabelText('Кінець періоду'), { target: { value: '' } }); expect((screen.getByRole('button', { name: 'Сформувати' }) as HTMLButtonElement).disabled).toBe(true)
})
