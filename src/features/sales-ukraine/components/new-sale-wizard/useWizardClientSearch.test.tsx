import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Client } from '../../../clients/types'
import { useWizardClientSearch } from './useWizardClientSearch'

const mocks = vi.hoisted(() => ({ search: vi.fn() }))
vi.mock('./wizardClientStepApi', () => ({ searchWizardClients: mocks.search }))
const client = (id: number): Client => ({ Id: id, NetUid: `client-${id}` })
const options = () => ({ permissionFlow: 'create' as const, onResults: vi.fn(), onAppendResults: vi.fn() })
function deferred() {
  let resolve!: (clients: Client[]) => void
  const promise = new Promise<Client[]>((next) => { resolve = next })
  return { promise, resolve }
}
async function tick() { await act(async () => { await vi.advanceTimersByTimeAsync(260) }) }
beforeEach(() => { vi.useFakeTimers(); mocks.search.mockReset().mockResolvedValue([client(1), client(2)]) })
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('wizard client search', () => {
  it('waits for three characters and ignores a late search as soon as the query changes', async () => {
    const old = deferred()
    mocks.search.mockReturnValueOnce(old.promise)
    const props = options()
    const { result } = renderHook(useWizardClientSearch, { initialProps: props })
    act(() => result.current.handleQueryChange('ab'))
    await tick()
    expect(mocks.search).not.toHaveBeenCalled()
    act(() => result.current.handleQueryChange('old'))
    await tick()
    const signal = mocks.search.mock.calls[0][3] as AbortSignal
    act(() => result.current.handleQueryChange('new'))
    expect(signal.aborted).toBe(true)
    props.onResults.mockClear()
    await act(async () => old.resolve([client(99)]))
    expect(props.onResults).not.toHaveBeenCalled()
    await tick()
    expect(props.onResults).toHaveBeenCalledWith([client(1), client(2)])
  })

  it('rejects an old page after a new query starts', async () => {
    const page = deferred()
    const props = options()
    const { result } = renderHook(useWizardClientSearch, { initialProps: props })
    act(() => result.current.handleQueryChange('first'))
    await tick()
    mocks.search.mockReturnValueOnce(page.promise)
    let request!: Promise<void>
    act(() => { request = result.current.runVirtualLoad() })
    const signal = mocks.search.mock.calls[1][3] as AbortSignal
    act(() => result.current.handleQueryChange('second'))
    await act(async () => { page.resolve([client(99)]); await request })
    expect(signal.aborted).toBe(true)
    expect(props.onAppendResults).not.toHaveBeenCalled()
  })

  it('deduplicates overlapping pages but advances by the raw server count and stops after exhaustion', async () => {
    const props = options()
    const { result } = renderHook(useWizardClientSearch, { initialProps: props })
    act(() => result.current.handleQueryChange('query'))
    await tick()
    mocks.search.mockResolvedValueOnce([client(2), client(3)]).mockResolvedValueOnce([])
    await act(async () => result.current.runVirtualLoad())
    expect(props.onAppendResults).toHaveBeenCalledExactlyOnceWith([client(3)])
    await act(async () => result.current.runVirtualLoad())
    expect(mocks.search.mock.calls[2][2]).toBe(4)
    await act(async () => result.current.runVirtualLoad())
    expect(mocks.search).toHaveBeenCalledTimes(3)
  })

  it('retains the offset after a failed page and serializes concurrent pagination', async () => {
    const props = options()
    const { result } = renderHook(useWizardClientSearch, { initialProps: props })
    act(() => result.current.handleQueryChange('query'))
    await tick()
    mocks.search.mockRejectedValueOnce(new Error('offline'))
    await act(async () => { await Promise.all([result.current.runVirtualLoad(), result.current.runVirtualLoad()]) })
    expect(mocks.search).toHaveBeenCalledTimes(2)
    await act(async () => result.current.runVirtualLoad())
    expect(mocks.search.mock.calls.slice(1).map((call) => call[2])).toEqual([2, 2])
  })

  it('uses the latest callbacks and cancels its timer on unmount', async () => {
    const props = options()
    const { result, rerender, unmount } = renderHook(useWizardClientSearch, { initialProps: props })
    act(() => result.current.handleQueryChange('query'))
    const onResults = vi.fn()
    rerender({ ...props, onResults })
    await tick()
    expect(onResults).toHaveBeenCalledOnce()
    expect(props.onResults).not.toHaveBeenCalled()
    act(() => result.current.handleQueryChange('later'))
    unmount()
    await tick()
    expect(mocks.search).toHaveBeenCalledOnce()
  })
})
