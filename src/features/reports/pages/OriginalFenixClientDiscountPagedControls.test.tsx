import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMemo, useState } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readFenixDiscountChoicePage } from '../api/originalFenixClientDiscountPagesApi'
import { emptyFenixSelection, fenixDiscountFields, type FenixDiscountChoice, type FenixDiscountField } from '../data/originalFenixClientDiscounts'
import { emptyFenixCaptions, type FenixDiscountCatalogue, type FenixDiscountChoicePage } from '../data/originalFenixClientDiscountPages'
import { fenixCatalogue, fenixChoicePage, fenixProductChoices } from '../testing/originalFenixClientDiscountPagesFixtures'
import { fenixChoices } from '../testing/originalFenixClientDiscountsFixtures'
import { OriginalFenixClientDiscountPagedControls } from './OriginalFenixClientDiscountPagedControls'
vi.mock('../api/originalFenixClientDiscountPagesApi', () => ({ readFenixDiscountChoicePage: vi.fn() }))
const universe = fenixProductChoices(201), catalogue = { ...fenixCatalogue(), Counts: { ...fenixCatalogue().Counts, Номенклатура: 201 } }
beforeEach(() => {
  vi.resetAllMocks(); vi.mocked(readFenixDiscountChoicePage).mockImplementation(async (query, names) => fenixChoicePage(query, names, query.Field === 'Номенклатура' ? universe : fenixChoices(query.Scope).Choices[query.Field]))
})
function Harness({ caller = 'caller1', permitted = true, names = catalogue }: { caller?: string; permitted?: boolean; names?: FenixDiscountCatalogue }) {
  const scope = useMemo(() => ({ caller, permitted }), [caller, permitted]), [selection, setSelection] = useState(emptyFenixSelection), [captions, setCaptions] = useState(emptyFenixCaptions)
  function select(field: FenixDiscountField, keys: string[], rows: FenixDiscountChoice[]) { setSelection(old => ({ ...old, [field]: keys })); setCaptions(old => ({ ...old, [field]: rows })) }
  return <MantineProvider env="test"><I18nProvider><OriginalFenixClientDiscountPagedControls through={names.Through} names={names} scope={scope} selection={selection} captions={captions}
    permitted={permitted} busy={false} dateError={null} error={null} loading={false} onLoad={() => undefined} onSelect={select} /></I18nProvider></MantineProvider>
}
const product = () => screen.getByRole('combobox', { name: 'Номенклатура' }) as HTMLInputElement
async function ready() { await waitFor(() => expect(product().disabled).toBe(false)) }
it('reaches options beyond100 and keeps authentic selected captions from earlier pages during search', async () => {
  render(<Harness />); await ready(); fireEvent.click(product()); fireEvent.click(await screen.findByRole('option', { name: 'Product 0001' })); fireEvent.blur(product())
  fireEvent.click(screen.getByRole('button', { name: 'Наступні назви: Номенклатура' })); await ready()
  fireEvent.click(product()); fireEvent.click(await screen.findByRole('option', { name: 'Product 0101' })); fireEvent.blur(product())
  expect(screen.getByText('Product 0001')).toBeTruthy(); expect(screen.getByText('Product 0101')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Пошук: Номенклатура'), { target: { value: 'Product 0201' } }); fireEvent.click(screen.getByRole('button', { name: 'Шукати: Номенклатура' })); await ready()
  fireEvent.click(product()); expect(await screen.findByRole('option', { name: 'Product 0201' })).toBeTruthy()
  const calls = vi.mocked(readFenixDiscountChoicePage).mock.calls.filter(([q]) => q.Field === 'Номенклатура'), last = calls[calls.length - 1][0]
  expect(last.SelectedKeys).toEqual([universe[0].Key, universe[100].Key]); expect(last.Search).toBe('Product 0201'); expect(last.Limit).toBe(100)
})
it('debounces consecutive edits before dispatching the latest search', async () => {
  render(<Harness />); await ready(); vi.useFakeTimers()
  try {
    const baseline = vi.mocked(readFenixDiscountChoicePage).mock.calls.length
    fireEvent.change(screen.getByLabelText('Пошук: Номенклатура'), { target: { value: 'Product 01' } })
    fireEvent.change(screen.getByLabelText('Пошук: Номенклатура'), { target: { value: 'Product 02' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(399) }); expect(readFenixDiscountChoicePage).toHaveBeenCalledTimes(baseline)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) });
    const last = vi.mocked(readFenixDiscountChoicePage).mock.calls.at(-1)![0]; expect(last.Search).toBe('Product 02'); expect(last.Offset).toBe(0)
  } finally { vi.useRealTimers() }
})
it('keeps search editable during its pending read, aborts immediately and debounces the replacement for 400 ms', async () => {
  render(<Harness />); await ready()
  let finish!: (v: FenixDiscountChoicePage) => void
  vi.mocked(readFenixDiscountChoicePage).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })); vi.useFakeTimers()
  try {
    const search = screen.getByLabelText('Пошук: Номенклатура') as HTMLInputElement
    fireEvent.change(search, { target: { value: 'Product 0001' } }); await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    const [query, names, signal] = vi.mocked(readFenixDiscountChoicePage).mock.calls.at(-1)!, count = vi.mocked(readFenixDiscountChoicePage).mock.calls.length
    expect(query.Search).toBe('Product 0001'); expect(signal?.aborted).toBe(false); expect(search.disabled).toBe(false); expect(product().disabled).toBe(true)
    fireEvent.change(search, { target: { value: 'Product 0201' } }); expect(signal?.aborted).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(399) }); expect(readFenixDiscountChoicePage).toHaveBeenCalledTimes(count)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) }); expect(readFenixDiscountChoicePage).toHaveBeenCalledTimes(count + 1)
    expect(vi.mocked(readFenixDiscountChoicePage).mock.calls.at(-1)![0].Search).toBe('Product 0201'); expect(product().disabled).toBe(false)
    await act(async () => { finish(fenixChoicePage(query, names, universe)) }); fireEvent.click(product())
    expect(screen.getByRole('option', { name: 'Product 0201' })).toBeTruthy(); expect(screen.queryByRole('option', { name: 'Product 0001' })).toBeNull()
  } finally { vi.useRealTimers() }
})
it('ignores late original page response after caller ABA and aborts its exact request', async () => {
  let finish!: (v: FenixDiscountChoicePage) => void
  vi.mocked(readFenixDiscountChoicePage).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(<Harness />); await waitFor(() => expect(readFenixDiscountChoicePage).toHaveBeenCalled())
  const [query, names, signal] = vi.mocked(readFenixDiscountChoicePage).mock.calls[0]
  view.rerender(<Harness caller="caller2" />); view.rerender(<Harness />); expect(signal?.aborted).toBe(true); await ready()
  const stale = fenixChoicePage(query, names, universe); stale.Items[0].Caption = 'stale original'
  await act(async () => { finish(stale) }); fireEvent.click(product()); expect(screen.queryByRole('option', { name: 'stale original' })).toBeNull()
})
it('permission loss cancels pages and no fresh selector I/O is dispatched while denied', async () => {
  const view = render(<Harness />); await ready(); const count = vi.mocked(readFenixDiscountChoicePage).mock.calls.length
  view.rerender(<Harness permitted={false} />); for (const field of fenixDiscountFields) expect((screen.getByRole('combobox', { name: field === 'ПолучательСкидки' ? 'Отримувач знижки' : field === 'КодПоРегиону' ? 'Прямий код регіону' : field }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Пошук: Номенклатура'), { target: { value: 'denied' } }); expect(readFenixDiscountChoicePage).toHaveBeenCalledTimes(count)
})
it('complete empty named family is usable while a missing caption family stays disabled without artificial options', async () => {
  const empty = { ...catalogue, Counts: { ...catalogue.Counts, Номенклатура: 0 } }
  vi.mocked(readFenixDiscountChoicePage).mockImplementation(async (query, names) => fenixChoicePage(query, names, query.Field === 'Номенклатура' ? [] : fenixChoices(query.Scope).Choices[query.Field]))
  const view = render(<Harness names={empty} />); await ready(); expect(screen.getByText(/0–0 \/ 0/)).toBeTruthy()
  const missing = { ...empty, FieldAvailability: { ...empty.FieldAvailability, Номенклатура: false }, MissingFamilies: ['Номенклатура' as const], HumanChoicesAvailable: false }
  view.rerender(<Harness names={missing} />); expect(product().disabled).toBe(true); expect(screen.queryByRole('option')).toBeNull()
})
it('unmount cancels exact page query and its pending debounce without a subsequent dispatch', async () => {
  const view = render(<Harness />); await ready(); const count = vi.mocked(readFenixDiscountChoicePage).mock.calls.length
  const signals = vi.mocked(readFenixDiscountChoicePage).mock.calls.map(c => c[2]); vi.useFakeTimers()
  try { fireEvent.change(screen.getByLabelText('Пошук: Номенклатура'), { target: { value: 'after unmount' } }); view.unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) }); expect(readFenixDiscountChoicePage).toHaveBeenCalledTimes(count); expect(signals.every(s => s?.aborted)).toBe(true)
  } finally { vi.useRealTimers() }
})
