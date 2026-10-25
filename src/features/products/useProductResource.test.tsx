import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useProductResource } from './useProductResource'

it('changes fallback translations without restarting a pending read', async () => {
  let reject!: (value: unknown) => void
  const load = vi.fn(() => new Promise<string | null>((_resolve, fail) => { reject = fail }))
  const { result, rerender } = renderHook(({ message }) => useProductResource('id', load, null, message), { initialProps: { message: 'old translation' } })
  rerender({ message: 'new translation' })
  expect(load).toHaveBeenCalledOnce()
  await act(async () => reject('network failed'))
  expect(result.current.error).toBe('new translation')
  rerender({ message: 'third translation' })
  expect(result.current.error).toBe('third translation')
  expect(load).toHaveBeenCalledOnce()
})

it('retires a pending retry on unmount and ignores its late response', async () => {
  let finish!: (value: string) => void
  const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(() => new Promise<string>(done => { finish = done }))
  const { result, unmount } = renderHook(() => useProductResource<string | null>('id', load, null, 'failed'))
  await waitFor(() => expect(result.current.error).toBe('offline'))
  let retry!: Promise<void>
  act(() => { retry = result.current.refresh() })
  const signal = load.mock.calls[1][1] as AbortSignal
  unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => { finish('late'); await retry })
})


it('debounces selection reads and lets an explicit retry bypass the timer', async () => {
  vi.useFakeTimers()
  try {
    const load = vi.fn(async (id: string) => id)
    const { result, rerender, unmount } = renderHook(({ id }) => useProductResource(id, load, null, 'failed', 250), { initialProps: { id: 'A' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    rerender({ id: 'B' })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    rerender({ id: 'C' })
    expect(load).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(250) })
    expect(load).toHaveBeenCalledExactlyOnceWith('C', expect.any(AbortSignal))
    expect(result.current.value).toBe('C')
    rerender({ id: 'D' })
    await act(() => result.current.refresh())
    await act(async () => { await vi.advanceTimersByTimeAsync(250) })
    expect(load).toHaveBeenCalledTimes(2)
    unmount()
  } finally { vi.useRealTimers() }
})

it('cancels a scheduled read when a saved snapshot arrives and uses a route snapshot without reading twice', async () => {
  vi.useFakeTimers()
  try {
    const load = vi.fn(async () => 'server')
    const { result, rerender, unmount } = renderHook(({ id, initial }) => useProductResource(id, load, null, 'failed', 250, initial), {
      initialProps: { id: 'A', initial: 'route' as string | undefined },
    })
    expect(result.current.value).toBe('route')
    await act(async () => { await vi.advanceTimersByTimeAsync(250) })
    expect(load).not.toHaveBeenCalled()
    await act(() => result.current.refresh())
    expect(result.current.value).toBe('server')
    rerender({ id: 'B', initial: undefined })
    act(() => { expect(result.current.setValue('saved')).toBe(true) })
    await act(async () => { await vi.advanceTimersByTimeAsync(250) })
    expect(load).toHaveBeenCalledOnce()
    expect(result.current.value).toBe('saved')
    unmount()
  } finally { vi.useRealTimers() }
})
