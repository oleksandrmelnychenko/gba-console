import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWizardQuantityForm } from './useWizardQuantityForm'
import { useWizardModalActions } from './useWizardModalActions'

afterEach(cleanup)
function options() {
  return { opened: true, sessionKey: 'row-a', availableQty: 10, initialQty: 2, initialComment: 'initial', onAccept: vi.fn(), onCancel: vi.fn() }
}
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((next) => { resolve = next })
  return { promise, resolve }
}

describe('cart quantity forms', () => {
  it.each(['', 0, -1, 'no number', NaN, Infinity, 10.001])('rejects invalid quantity %s', async (value) => {
    const props = options()
    const { result } = renderHook(() => useWizardQuantityForm(props))
    await act(async () => { result.current.setValue(value); await result.current.confirm() })
    expect(result.current.showError).toBe(true)
    expect(props.onAccept).not.toHaveBeenCalled()
  })

  it('accepts decimal commas and the latest comment in the same event turn', async () => {
    const props = options()
    const { result } = renderHook(() => useWizardQuantityForm(props))
    await act(async () => {
      result.current.setValue('1,125')
      result.current.setComment('updated')
      await result.current.confirm()
    })
    expect(props.onAccept).toHaveBeenCalledExactlyOnceWith(1.125, 'updated')
  })

  it('revalidates stock changes without discarding the draft and accepts the exact limit', async () => {
    const props = options()
    const { result, rerender } = renderHook(useWizardQuantityForm, { initialProps: props })
    act(() => result.current.setValue(5))
    rerender({ ...props, availableQty: 4 })
    expect(result.current.value).toBe(5)
    expect(result.current.showError).toBe(true)
    rerender({ ...props, availableQty: 5 })
    await act(async () => { await result.current.confirm() })
    expect(props.onAccept).toHaveBeenCalledExactlyOnceWith(5, 'initial')
  })

  it('resets drafts and validation when changing rows or reopening', () => {
    const props = options()
    const { result, rerender } = renderHook(useWizardQuantityForm, { initialProps: props })
    act(() => { result.current.setValue(99); result.current.setComment('draft') })
    rerender({ ...props, sessionKey: 'row-b', initialQty: 3, initialComment: 'second' })
    expect(result.current).toMatchObject({ value: 3, comment: 'second', showError: false })
    rerender(props)
    expect(result.current).toMatchObject({ value: 2, comment: 'initial', showError: false })
    act(() => result.current.setValue(4))
    rerender({ ...props, opened: false })
    rerender(props)
    expect(result.current.value).toBe(2)
  })
})

describe('cart modal actions', () => {
  it('locks confirmation and cancellation synchronously until the operation settles', async () => {
    const pending = deferred()
    const props = { opened: true, onConfirm: vi.fn(() => pending.promise), onCancel: vi.fn() }
    const { result } = renderHook(() => useWizardModalActions(props))
    let request!: Promise<void>
    act(() => { request = result.current.confirm(); void result.current.confirm(); result.current.cancel() })
    expect(props.onConfirm).toHaveBeenCalledOnce()
    expect(props.onCancel).not.toHaveBeenCalled()
    expect(result.current.isBusy).toBe(true)
    await act(async () => { pending.resolve(); await request })
    expect(result.current.isBusy).toBe(false)
    act(() => { result.current.cancel(); result.current.cancel(); void result.current.confirm() })
    expect(props.onCancel).toHaveBeenCalledOnce()
    expect(props.onConfirm).toHaveBeenCalledOnce()
  })

  it('does not let an old request unlock a reopened modal', async () => {
    const old = deferred(), current = deferred()
    const props = { opened: true, sessionKey: 'a', onConfirm: vi.fn(() => old.promise), onCancel: vi.fn() }
    const { result, rerender } = renderHook(useWizardModalActions, { initialProps: props })
    let first!: Promise<void>, second!: Promise<void>
    act(() => { first = result.current.confirm() })
    rerender({ ...props, opened: false })
    rerender({ ...props, onConfirm: vi.fn(() => current.promise) })
    act(() => { second = result.current.confirm() })
    await act(async () => { old.resolve(); await first })
    expect(result.current.isBusy).toBe(true)
    act(() => result.current.cancel())
    expect(props.onCancel).not.toHaveBeenCalled()
    await act(async () => { current.resolve(); await second })
    expect(result.current.isBusy).toBe(false)
  })

  it('releases the lock after failure and permits retry', async () => {
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useWizardModalActions({ opened: true, onConfirm, onCancel: vi.fn() }))
    await act(async () => { await expect(result.current.confirm()).rejects.toThrow('failed') })
    expect(result.current.isBusy).toBe(false)
    await act(async () => { await result.current.confirm() })
    expect(onConfirm).toHaveBeenCalledTimes(2)
  })

  it('ignores actions while externally busy or closed', async () => {
    const props = { opened: true, busy: true, onConfirm: vi.fn(), onCancel: vi.fn() }
    const { result, rerender } = renderHook(useWizardModalActions, { initialProps: props })
    await act(async () => { await result.current.confirm(); result.current.cancel() })
    rerender({ ...props, opened: false, busy: false })
    await act(async () => { await result.current.confirm(); result.current.cancel() })
    expect(props.onConfirm).not.toHaveBeenCalled()
    expect(props.onCancel).not.toHaveBeenCalled()
  })
})
