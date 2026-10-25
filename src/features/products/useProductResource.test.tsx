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
