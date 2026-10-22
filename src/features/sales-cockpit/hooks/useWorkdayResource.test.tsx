import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWorkdayResource } from './useWorkdayResource'

describe('workday request lifetime', () => {
  afterEach(() => vi.useRealTimers())
  it('ignores a late previous filter response and aborts its request', async () => {
    let finishOld!: (value: string) => void
    const oldLoad = vi.fn((signal: AbortSignal) => new Promise<string>((resolve) => { finishOld = resolve; expect(signal.aborted).toBe(false) }))
    const newLoad = vi.fn(async () => 'new filter result')
    const initialProps: { load: (signal: AbortSignal) => Promise<string>; query: string } = { load: oldLoad, query: 'old' }
    const view = renderHook(({ load, query }) => useWorkdayResource(load, query), { initialProps })
    view.rerender({ load: newLoad, query: 'new' })
    await waitFor(() => expect(view.result.current.data).toBe('new filter result'))
    expect(oldLoad.mock.calls[0][0].aborted).toBe(true)
    await act(async () => { finishOld('outdated result') })
    expect(view.result.current.data).toBe('new filter result')
  })
  it('pauses polling and realtime revision while a draft is open, then refreshes once resumed', async () => {
    vi.useFakeTimers()
    const load = vi.fn(async () => 'result')
    const view = renderHook(({ query, paused }) => useWorkdayResource(load, query, paused), { initialProps: { query: 'v1', paused: false } })
    await act(async () => {})
    expect(load).toHaveBeenCalledTimes(1)
    view.rerender({ query: 'v2', paused: true })
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    expect(load).toHaveBeenCalledTimes(1)
    view.rerender({ query: 'v2', paused: false })
    await act(async () => {})
    expect(load).toHaveBeenCalledTimes(2)
    expect(view.result.current.data).toBe('result')
  })
  it('does not poll a hidden document or set a failure after unmount', async () => {
    vi.useFakeTimers()
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    let reject!: (error: Error) => void
    const load = vi.fn(() => new Promise<string>((_resolve, fail) => { reject = fail }))
    const view = renderHook(() => useWorkdayResource(load, 'query'))
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    expect(load).toHaveBeenCalledTimes(1)
    view.unmount()
    await act(async () => { reject(new Error('late error')) })
    visibility.mockRestore()
  })
})
