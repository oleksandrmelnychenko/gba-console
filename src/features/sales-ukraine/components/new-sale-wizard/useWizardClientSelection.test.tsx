import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Client, ClientAgreement, ClientInDebt } from '../../../clients/types'
import { useWizardClientSelection } from './useWizardClientSelection'

const mocks = vi.hoisted(() => ({ agreements: vi.fn(), debts: vi.fn(), identity: vi.fn(), header: vi.fn(), children: vi.fn(), keyboard: vi.fn() }))
vi.mock('./wizardClientStepApi', () => ({ getWizardClientAgreements: mocks.agreements, getWizardClientGroupedDebts: mocks.debts, getWizardClientIdentityAttention: mocks.identity }))
vi.mock('./wizardSaleHeaderApi', () => ({ getWizardHeaderClient: mocks.header }))
vi.mock('../../../clients/api/clientCabinetApi', () => ({ getClientSubClients: mocks.children }))
vi.mock('./wizardKeyboard', () => ({ setWizardKeyboardState: mocks.keyboard }))
const client = (id: number): Client => ({ Id: id, NetUid: `client-${id}`, RegionCode: { Value: `CN0100${id}` } })
const first: ClientAgreement = { Id: 1, NetUid: 'agreement-1', Agreement: { IsActive: false } }
const active: ClientAgreement = { Id: 2, NetUid: 'agreement-2', Agreement: { IsActive: true } }
function options() {
  return {
    clientNetId: null as string | null, initialClient: null as Client | null, permissionFlow: 'create' as const,
    hasRegistryItems: false, onClientChange: vi.fn(), onClientResolved: vi.fn(), onAgreementChange: vi.fn(),
    onShowClient: vi.fn(), resetRegister: vi.fn(), fetchRegister: vi.fn(async () => {}),
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mocks.agreements.mockReset().mockResolvedValue([first, active])
  mocks.debts.mockReset().mockResolvedValue([])
  mocks.identity.mockReset().mockResolvedValue(null)
  mocks.header.mockReset().mockResolvedValue(null)
  mocks.children.mockReset().mockResolvedValue(null)
})
afterEach(() => { cleanup(); vi.useRealTimers() })
async function tick() { await act(async () => { await vi.advanceTimersByTimeAsync(220) }) }

describe('wizard client selection', () => {
  it('loads independent details in parallel and preserves the chosen agreement on repeated confirmation', async () => {
    const pending = deferred<ClientInDebt[]>()
    mocks.debts.mockReturnValueOnce(pending.promise)
    const props = options()
    const { result } = renderHook(useWizardClientSelection, { initialProps: props })
    await act(async () => result.current.confirmClient(client(1)))
    expect(mocks.debts).toHaveBeenCalledWith('client-1', expect.any(AbortSignal))
    expect(props.fetchRegister).toHaveBeenCalledOnce()
    expect(result.current.selectedAgreement).toBe(active)
    act(() => { result.current.selectAgreement(first); result.current.confirmClient(client(1)) })
    expect(result.current.selectedAgreement).toBe(first)
    expect(mocks.agreements).toHaveBeenCalledOnce()
    expect(mocks.debts).toHaveBeenCalledOnce()
    await act(async () => pending.resolve([]))
    act(() => result.current.confirmClient(client(1)))
    expect(result.current.selectedAgreement).toBe(first)
    expect(mocks.agreements).toHaveBeenCalledOnce()
  })

  it('uses a trailing preview and flushes it on Enter without duplicating requests', async () => {
    const props = options()
    const { result } = renderHook(useWizardClientSelection, { initialProps: props })
    act(() => result.current.confirmClient(client(1), { debounceDetails: true }))
    expect(props.onClientChange).toHaveBeenLastCalledWith(null)
    expect(props.onAgreementChange).toHaveBeenLastCalledWith(null, null)
    act(() => result.current.confirmClient(client(2), { debounceDetails: true }))
    expect(mocks.agreements).not.toHaveBeenCalled()
    await act(async () => result.current.confirmClient(client(2)))
    await tick()
    expect(mocks.agreements).toHaveBeenCalledExactlyOnceWith('client-2', expect.any(AbortSignal))
    expect(props.onClientChange).toHaveBeenLastCalledWith('client-2')
  })

  it('ignores old agreements and debts after switching away and back to a client', async () => {
    const oldAgreements = deferred<ClientAgreement[]>()
    const oldDebts = deferred<ClientInDebt[]>()
    mocks.agreements.mockReturnValueOnce(oldAgreements.promise)
    mocks.debts.mockReturnValueOnce(oldDebts.promise)
    const props = options()
    const { result } = renderHook(useWizardClientSelection, { initialProps: props })
    act(() => result.current.confirmClient(client(1)))
    await act(async () => result.current.confirmClient(client(2)))
    await act(async () => result.current.confirmClient(client(1)))
    props.onAgreementChange.mockClear()
    await act(async () => { oldAgreements.resolve([{ NetUid: 'stale' }]); oldDebts.resolve([{ Debt: { Total: 999 } }]) })
    expect(result.current.selectedAgreement).toBe(active)
    expect(result.current.groupedDebts).toEqual([])
    expect(props.onAgreementChange).not.toHaveBeenCalled()
  })

  it('deduplicates concurrent debt refreshes and keeps them scoped to the selected client', async () => {
    const { result } = renderHook(useWizardClientSelection, { initialProps: options() })
    await act(async () => result.current.confirmClient(client(1)))
    const pending = deferred<ClientInDebt[]>()
    mocks.debts.mockReturnValueOnce(pending.promise)
    let one!: Promise<boolean>
    let two!: Promise<boolean>
    act(() => { one = result.current.refreshGroupedDebts(); two = result.current.refreshGroupedDebts() })
    expect(one).toBe(two)
    expect(mocks.debts).toHaveBeenCalledTimes(2)
    await act(async () => result.current.confirmClient(client(2)))
    await act(async () => { pending.resolve([{ Debt: { Total: 999 } }]); await one })
    expect(result.current.groupedDebts).toEqual([])
  })

  it('wraps agreement navigation and rejects a selection belonging to the previous client', async () => {
    const { result } = renderHook(useWizardClientSelection, { initialProps: options() })
    await act(async () => result.current.confirmClient(client(1)))
    act(() => result.current.selectNextAgreement())
    expect(result.current.selectedAgreement).toBe(first)
    act(() => result.current.selectPreviousAgreement())
    expect(result.current.selectedAgreement).toBe(active)
    act(() => { result.current.unselectClient(); result.current.selectAgreement(first) })
    expect(result.current.selectedAgreement).toBeNull()
  })

  it('retries failed details on confirmation and falls back to the first agreement', async () => {
    mocks.agreements.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([first])
    const { result } = renderHook(useWizardClientSelection, { initialProps: options() })
    await act(async () => result.current.confirmClient(client(1)))
    expect(result.current.agreementsLoading).toBe(false)
    expect(result.current.selectedAgreement).toBeNull()
    await act(async () => result.current.confirmClient(client(1)))
    expect(result.current.selectedAgreement).toBe(first)
    expect(mocks.agreements).toHaveBeenCalledTimes(2)
  })

  it('keeps callbacks current without restarting the asynchronous client restore', async () => {
    const pending = deferred<Client | null>()
    mocks.header.mockReturnValueOnce(pending.promise)
    const props = { ...options(), clientNetId: 'client-1' }
    const { result, rerender } = renderHook(useWizardClientSelection, { initialProps: props })
    const onClientChange = vi.fn()
    const onAgreementChange = vi.fn()
    rerender({ ...props, onClientChange, onAgreementChange })
    await act(async () => pending.resolve(client(1)))
    expect(mocks.header).toHaveBeenCalledOnce()
    expect(onClientChange).toHaveBeenCalledWith('client-1')
    expect(onAgreementChange).toHaveBeenLastCalledWith('agreement-2', active)
    expect(result.current.selectedClient?.NetUid).toBe('client-1')
  })

  it('does not restore a previous client after the user has started searching', async () => {
    const pending = deferred<Client | null>()
    mocks.header.mockReturnValueOnce(pending.promise)
    const props = { ...options(), clientNetId: 'client-1' }
    const { result } = renderHook(useWizardClientSelection, { initialProps: props })
    act(() => result.current.unselectClient())
    await act(async () => pending.resolve(client(1)))
    expect(result.current.selectedClient).toBeNull()
    expect(props.onShowClient).not.toHaveBeenCalled()
    expect(mocks.agreements).not.toHaveBeenCalled()
    expect(props.onClientChange).toHaveBeenCalledExactlyOnceWith(null)
  })

  it('clears selection when a structural folder is opened and skips its details', async () => {
    const folder = { ...client(2), RegionCode: { Value: 'VI01000' }, SubClients: [{ SubClient: client(3) }] }
    const props = options()
    const { result } = renderHook(useWizardClientSelection, { initialProps: props })
    await act(async () => result.current.confirmClient(client(1)))
    act(() => result.current.confirmClient(folder))
    expect(result.current.selectedClient).toBeNull()
    expect(result.current.agreements).toEqual([])
    expect(props.onShowClient).toHaveBeenCalledWith(folder)
    expect(mocks.agreements).toHaveBeenCalledOnce()
  })

  it('does not notify the host on empty search keystrokes and cancels preview on unmount', async () => {
    const props = options()
    const { result, unmount } = renderHook(useWizardClientSelection, { initialProps: props })
    act(() => { result.current.unselectClient(); result.current.unselectClient() })
    expect(props.onClientChange).not.toHaveBeenCalled()
    act(() => result.current.confirmClient(client(1), { debounceDetails: true }))
    unmount()
    await tick()
    expect(mocks.agreements).not.toHaveBeenCalled()
  })

  it('debounces identity attention with the other preview details and flushes it on confirmation', async () => {
    const { result } = renderHook(useWizardClientSelection, { initialProps: options() })
    act(() => result.current.confirmClient(client(1), { debounceDetails: true }))
    act(() => result.current.confirmClient(client(2), { debounceDetails: true }))
    expect(mocks.identity).not.toHaveBeenCalled()
    await tick()
    expect(mocks.identity).toHaveBeenCalledExactlyOnceWith('client-2', expect.any(AbortSignal))
    act(() => result.current.confirmClient(client(2)))
    expect(mocks.identity).toHaveBeenCalledOnce()
  })

  it('aborts all retired detail reads and ignores late responses while keeping agreements independent', async () => {
    const oldDebt = deferred<ClientInDebt[]>()
    const oldIdentity = deferred<{ ClientNetUid: string }>()
    mocks.debts.mockReturnValueOnce(oldDebt.promise)
    mocks.identity.mockReturnValueOnce(oldIdentity.promise)
    const { result, unmount } = renderHook(useWizardClientSelection, { initialProps: options() })
    await act(async () => result.current.confirmClient(client(1)))
    expect(result.current.selectedAgreement).toBe(active)
    const signals = [mocks.agreements, mocks.debts, mocks.identity].map(mock => mock.mock.calls[0][1] as AbortSignal)
    act(() => result.current.confirmClient(client(2), { debounceDetails: true }))
    expect(signals.every(signal => signal?.aborted)).toBe(true)
    await act(async () => { oldDebt.resolve([{ Debt: { Total: 999 } }]); oldIdentity.resolve({ ClientNetUid: 'client-1' }) })
    expect(result.current.groupedDebts).toEqual([])
    expect(result.current.identityAttention).toBeNull()
    await tick()
    const currentSignal = mocks.agreements.mock.calls[1][1] as AbortSignal
    unmount()
    expect(currentSignal.aborted).toBe(true)
  })

})
