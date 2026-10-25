import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWizardClientSalesRegister } from './useWizardClientSalesRegister'
import type { WizardSaleRegisterItem } from './wizardClientStepApi'

const mocks = vi.hoisted(() => ({ load: vi.fn(), row: vi.fn(), realtime: new Map<string, () => void>() }))
vi.mock('./wizardClientStepApi', async (original) => ({ ...await original<typeof import('./wizardClientStepApi')>(), getWizardSalesRegister: mocks.load }))
vi.mock('../../../../shared/sale-audit/saleAuditApi', () => ({ getSalesUkraineEditSaleStatistic: mocks.row, getSalesUkraineSaleAudit: mocks.row }))
vi.mock('../../../../shared/realtime/events', () => ({
  realtimeEvents: { saleAdded: 'added', saleUpdated: 'updated' },
  useRealtimeEvent: (event: string, handler: () => void) => { mocks.realtime.set(event, handler) },
}))
const rows = (id: string): WizardSaleRegisterItem[] => [{ SaleStatistic: { Sale: { NetUid: id } } }]
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}
beforeEach(() => { vi.useFakeTimers(); mocks.load.mockReset().mockResolvedValue(rows('sale-1')); mocks.row.mockReset(); mocks.realtime.clear() })
afterEach(() => { cleanup(); vi.useRealTimers() })
function setup() {
  const hook = renderHook(useWizardClientSalesRegister)
  act(() => hook.result.current.resetRegister('client-1'))
  return hook
}

describe('wizard client sales register', () => {
  it('shares the in-flight promise so callers wait until the register has actually loaded', async () => {
    const pending = deferred<WizardSaleRegisterItem[]>()
    mocks.load.mockReturnValueOnce(pending.promise)
    const { result } = setup()
    let first!: Promise<void>
    let second!: Promise<void>
    act(() => { first = result.current.fetchRegister(); second = result.current.fetchRegister() })
    expect(second).toBe(first)
    expect(mocks.load).toHaveBeenCalledOnce()
    expect(result.current.isRegistryLoading).toBe(true)
    await act(async () => { pending.resolve(rows('sale-1')); await second })
    expect(result.current.registryItems[0].Sale?.NetUid).toBe('sale-1')
    expect(result.current.isRegistryLoading).toBe(false)
  })

  it('does not let an old A request clear the newer A request after A-B-A filter changes', async () => {
    const old = deferred<WizardSaleRegisterItem[]>()
    const current = deferred<WizardSaleRegisterItem[]>()
    mocks.load.mockReturnValueOnce(old.promise).mockResolvedValueOnce([]).mockReturnValueOnce(current.promise)
    const { result } = setup()
    let first!: Promise<void>
    let latest!: Promise<void>
    act(() => {
      first = result.current.fetchRegister()
      result.current.handleStatusChange(0)
      result.current.handleStatusChange(6)
      latest = result.current.fetchRegister()
    })
    await act(async () => { old.resolve(rows('old')); await first })
    expect(result.current.isRegistryLoading).toBe(true)
    expect(result.current.fetchRegister()).toBe(latest)
    expect(mocks.load).toHaveBeenCalledTimes(3)
    await act(async () => { current.resolve(rows('current')); await latest })
    expect(result.current.registryItems[0].Sale?.NetUid).toBe('current')
  })

  it('combines same-turn filter changes and cancels the superseded search timer', async () => {
    const { result } = setup()
    await act(async () => {
      result.current.handleSaleSearchChange('invoice')
      result.current.handleStatusChange(1)
      result.current.handleDateFromChange('2026-10-01')
    })
    expect(mocks.load.mock.calls.at(-1)?.[0]).toMatchObject({ value: 'invoice', type: 1, from: '2026-10-01' })
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    expect(mocks.load).toHaveBeenCalledTimes(2)
  })

  it('cancels pending search and ignores the old client response after selection changes', async () => {
    const old = deferred<WizardSaleRegisterItem[]>()
    mocks.load.mockReturnValueOnce(old.promise)
    const { result } = setup()
    let request!: Promise<void>
    act(() => { request = result.current.fetchRegister() })
    const signal = mocks.load.mock.calls[0][1] as AbortSignal
    act(() => { result.current.handleSaleSearchChange('draft'); result.current.resetRegister('client-2') })
    await act(async () => { old.resolve(rows('old')); await request; await vi.advanceTimersByTimeAsync(500) })
    expect(signal.aborted).toBe(true)
    expect(result.current.registryItems).toEqual([])
    expect(mocks.load).toHaveBeenCalledOnce()
    await act(async () => result.current.fetchRegister())
    expect(mocks.load.mock.calls[1][0].clientNetId).toBe('client-2')
  })

  it('coalesces realtime events and retires the timer when a manual refresh already handles them', async () => {
    const { result } = setup()
    act(() => { mocks.realtime.get('added')?.(); mocks.realtime.get('updated')?.() })
    await act(async () => result.current.fetchRegister())
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    expect(mocks.load).toHaveBeenCalledOnce()
  })

  it('ignores a row refresh started for the previous register, even if the new list includes the same sale', async () => {
    const old = deferred<{ Sale: { NetUid: string; Id: number } }>()
    mocks.row.mockReturnValueOnce(old.promise)
    const { result } = setup()
    await act(async () => result.current.fetchRegister())
    let request!: Promise<void>
    act(() => { request = result.current.refreshRegistryRow({ NetUid: 'sale-1' }, false); result.current.resetRegister('client-2') })
    await act(async () => result.current.fetchRegister())
    await act(async () => { old.resolve({ Sale: { NetUid: 'sale-1', Id: 99 } }); await request })
    expect(result.current.registryItems[0].Sale?.Id).toBeUndefined()
  })

  it('aborts requests and clears timers on unmount', async () => {
    const pending = deferred<WizardSaleRegisterItem[]>()
    mocks.load.mockReturnValueOnce(pending.promise)
    const { result, unmount } = setup()
    let request!: Promise<void>
    act(() => { request = result.current.fetchRegister(); mocks.realtime.get('added')?.() })
    const signal = mocks.load.mock.calls[0][1] as AbortSignal
    unmount()
    await act(async () => { pending.resolve([]); await request; await vi.advanceTimersByTimeAsync(500) })
    expect(signal.aborted).toBe(true)
    expect(mocks.load).toHaveBeenCalledOnce()
  })
  it('keeps equivalent search input pending and preserves loaded rows for unchanged filters', async () => {
    const pending = deferred<WizardSaleRegisterItem[]>()
    mocks.load.mockReturnValueOnce(pending.promise)
    const { result } = setup()
    act(() => result.current.handleSaleSearchChange(' invoice '))
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    const signal = mocks.load.mock.calls[0][1] as AbortSignal
    act(() => {
      result.current.handleSaleSearchChange('invoice')
      result.current.handleStatusChange(result.current.statusFilter)
      result.current.handleDateFromChange(result.current.dateFrom)
      result.current.handleDateToChange(result.current.dateTo)
    })
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(signal.aborted).toBe(false)
    expect(mocks.load).toHaveBeenCalledOnce()
    expect(mocks.load.mock.calls[0][0].value).toBe('invoice')
    await act(async () => { pending.resolve(rows('sale-1')) })
    const loaded = result.current.registryItems
    await act(async () => {
      result.current.handleSaleSearchChange(' invoice ')
      result.current.handleStatusChange(result.current.statusFilter)
      result.current.handleDateFromChange(result.current.dateFrom)
      result.current.handleDateToChange(result.current.dateTo)
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(mocks.load).toHaveBeenCalledOnce()
    expect(result.current.registryItems).toBe(loaded)
    expect(result.current.isRegistryLoading).toBe(false)
    await act(async () => result.current.fetchRegister())
    expect(mocks.load).toHaveBeenCalledTimes(2)
  })

  it('retries an unchanged filter after failure and still refreshes on realtime events', async () => {
    mocks.load.mockRejectedValueOnce(new Error('offline'))
    const { result } = setup()
    await act(async () => result.current.fetchRegister())
    await act(async () => result.current.handleStatusChange(result.current.statusFilter))
    expect(mocks.load).toHaveBeenCalledTimes(2)
    expect(result.current.registryItems[0].Sale?.NetUid).toBe('sale-1')
    await act(async () => { mocks.realtime.get('updated')?.(); await vi.advanceTimersByTimeAsync(400) })
    expect(mocks.load).toHaveBeenCalledTimes(3)
  })

  it('shares pending row reads within their permission scope and aborts them on filter changes', async () => {
    const pending = deferred<{ Sale: { NetUid: string } }>()
    mocks.row.mockReturnValue(pending.promise)
    const { result } = setup()
    await act(async () => result.current.fetchRegister())
    let first!: Promise<void>
    let second!: Promise<void>
    let audit!: Promise<void>
    act(() => {
      first = result.current.refreshRegistryRow({ NetUid: 'sale-1' }, false)
      second = result.current.refreshRegistryRow({ NetUid: 'sale-1' }, true)
      audit = result.current.refreshRegistryRow({ NetUid: 'sale-1' }, false, 'audit')
    })
    expect(second).toBe(first)
    expect(mocks.row).toHaveBeenCalledTimes(2)
    const signals = mocks.row.mock.calls.map(call => call[1] as AbortSignal)
    act(() => result.current.handleSaleSearchChange('new'))
    expect(signals.every(signal => signal.aborted)).toBe(true)
    await act(async () => { pending.resolve({ Sale: { NetUid: 'sale-1' } }); await Promise.all([first, audit]) })
  })

  it('refreshes list and edited totals concurrently after save, bypassing the pre-save request', async () => {
    const old = deferred<WizardSaleRegisterItem[]>()
    const list = deferred<WizardSaleRegisterItem[]>()
    const statistic = deferred<{ Sale: { NetUid: string; TotalAmount: number } }>()
    mocks.load.mockReturnValueOnce(old.promise).mockReturnValueOnce(list.promise)
    mocks.row.mockReturnValueOnce(statistic.promise)
    const { result } = setup()
    let before!: Promise<void>
    let saved!: Promise<void>
    act(() => { before = result.current.fetchRegister(); saved = result.current.refreshAfterSave({ NetUid: 'sale-1' }) })
    expect(mocks.load.mock.calls[0][1].aborted).toBe(true)
    expect(mocks.load.mock.calls[1][2]).toEqual({ fresh: true })
    expect(mocks.row).toHaveBeenCalledWith('sale-1', expect.any(AbortSignal), { fresh: true })
    await act(async () => { statistic.resolve({ Sale: { NetUid: 'sale-1', TotalAmount: 20 } }) })
    expect(result.current.registryItems).toEqual([])
    await act(async () => { list.resolve([...rows('sale-1'), ...rows('child')]); await saved })
    expect(result.current.registryItems.map(item => item.Sale?.NetUid)).toEqual(['sale-1', 'child'])
    expect(result.current.registryItems[0].Sale?.TotalAmount).toBe(20)
    const current = result.current.registryItems
    await act(async () => { old.resolve(rows('stale')); await before })
    expect(result.current.registryItems).toBe(current)
  })

  it('does not insert an edited sale excluded by the current filter and tolerates a failed total read', async () => {
    const { result } = setup()
    mocks.load.mockResolvedValue(rows('other'))
    mocks.row.mockResolvedValue({ Sale: { NetUid: 'sale-1' } })
    await act(async () => result.current.refreshAfterSave({ NetUid: 'sale-1' }))
    expect(result.current.registryItems.map(item => item.Sale?.NetUid)).toEqual(['other'])
    mocks.row.mockRejectedValueOnce(new Error('offline'))
    await act(async () => result.current.refreshAfterSave({ NetUid: 'sale-1' }))
    expect(result.current.registryItems.map(item => item.Sale?.NetUid)).toEqual(['other'])
  })

  it('retires both post-save reads when the client changes', async () => {
    const list = deferred<WizardSaleRegisterItem[]>()
    const statistic = deferred<{ Sale: { NetUid: string } }>()
    mocks.load.mockReturnValueOnce(list.promise)
    mocks.row.mockReturnValueOnce(statistic.promise)
    const { result } = setup()
    let saved!: Promise<void>
    act(() => { saved = result.current.refreshAfterSave({ NetUid: 'sale-1' }); result.current.resetRegister('client-2') })
    expect(mocks.load.mock.calls[0][1].aborted).toBe(true)
    expect(mocks.row.mock.calls[0][1].aborted).toBe(true)
    await act(async () => { list.resolve(rows('sale-1')); statistic.resolve({ Sale: { NetUid: 'sale-1' } }); await saved })
    expect(result.current.registryItems).toEqual([])
  })

})
