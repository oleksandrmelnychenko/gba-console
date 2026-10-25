import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useSaleEditSubmit } from './useSaleEditSubmit'

const mocks = vi.hoisted(() => ({ run: vi.fn(), resume: vi.fn(), notify: vi.fn(), pending: false, t: (value: string) => value }))
vi.mock('../usePersistentSaleJsonMutation', () => ({ usePersistentSaleJsonMutation: () => ({
  run: mocks.run, resume: mocks.resume, hasPending: mocks.pending, pendingError: null,
}) }))
vi.mock('../api/salesUkraineApi', () => ({ shiftOrderItemsCurrent: vi.fn() }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notify } }))
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.t }) }))
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (value: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
beforeEach(() => { vi.clearAllMocks(); mocks.pending = false; mocks.t = value => value })
afterEach(cleanup)
const sale = { NetUid: 'sale-1' }

it('shares submit and recovery through post-save refresh and publishes completion once', async () => {
  const write = deferred<{ completed: true }>()
  const refresh = deferred<void>()
  mocks.run.mockReturnValue(write.promise)
  const onSaved = vi.fn(() => refresh.promise)
  const { result } = renderHook(() => useSaleEditSubmit({ context: 'sale-1', ready: true, onSaved }))
  let first!: Promise<void>
  act(() => {
    first = result.current.submit(sale)
    expect(result.current.submit(sale)).toBe(first)
    expect(result.current.recover()).toBe(first)
  })
  expect(mocks.run).toHaveBeenCalledOnce()
  expect(mocks.resume).not.toHaveBeenCalled()
  await act(async () => { write.resolve({ completed: true }) })
  expect(onSaved).toHaveBeenCalledOnce()
  expect(result.current.isSaving).toBe(true)
  expect(mocks.notify).toHaveBeenCalledOnce()
  act(() => { expect(result.current.submit(sale)).toBe(first) })
  await act(async () => { refresh.resolve(); await first })
  expect(result.current.isSaving).toBe(false)
})

it('keeps a recovery alive through callback, translation and pending-state changes', async () => {
  const write = deferred<{ completed: true }>()
  mocks.pending = true
  mocks.resume.mockReturnValue(write.promise)
  const oldSaved = vi.fn()
  const onSaved = vi.fn()
  const { rerender } = renderHook(useSaleEditSubmit, { initialProps: { context: 'sale-1', ready: true, onSaved: oldSaved } })
  mocks.t = value => `translated: ${value}`
  mocks.pending = false
  rerender({ context: 'sale-1', ready: true, onSaved })
  await act(async () => { write.resolve({ completed: true }) })
  expect(mocks.resume).toHaveBeenCalledOnce()
  expect(oldSaved).not.toHaveBeenCalled()
  expect(onSaved).toHaveBeenCalledOnce()
  expect(mocks.notify).toHaveBeenCalledWith({ color: 'green', message: 'translated: Попередню операцію підтверджено' })
})

it('lets the write settle after unmount without callbacks or notifications for the retired editor', async () => {
  const write = deferred<{ completed: true }>()
  mocks.run.mockReturnValue(write.promise)
  const onSaved = vi.fn()
  const { result, unmount } = renderHook(() => useSaleEditSubmit({ context: 'sale-1', ready: true, onSaved }))
  let request!: Promise<void>
  act(() => { request = result.current.submit(sale) })
  unmount()
  await act(async () => { write.resolve({ completed: true }); await request })
  expect(onSaved).not.toHaveBeenCalled()
  expect(mocks.notify).not.toHaveBeenCalled()
})

it('does not automatically replay a newly uncertain submit or repeat a confirmed write when refresh fails', async () => {
  mocks.run.mockResolvedValueOnce({ completed: false }).mockResolvedValueOnce({ completed: true })
  const onSaved = vi.fn().mockRejectedValue(new Error('read failed'))
  const { result, rerender } = renderHook(useSaleEditSubmit, { initialProps: { context: 'sale-1', ready: true, onSaved } })
  await act(async () => result.current.submit(sale))
  mocks.pending = true
  rerender({ context: 'sale-1', ready: true, onSaved })
  expect(mocks.resume).not.toHaveBeenCalled()
  expect(onSaved).not.toHaveBeenCalled()
  mocks.pending = false
  await act(async () => result.current.submit(sale))
  expect(mocks.run).toHaveBeenCalledTimes(2)
  expect(mocks.notify).toHaveBeenLastCalledWith({ color: 'orange', message: 'Зміни збережено, але не вдалося оновити реєстр' })
  expect(result.current.isSaving).toBe(false)
})
