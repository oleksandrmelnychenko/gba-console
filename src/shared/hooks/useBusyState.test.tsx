import { StrictMode, type FormEvent } from 'react'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useBusyState } from './useBusyState'

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

describe('useBusyState', () => {
  it('acquires synchronously before React renders and keeps callbacks stable', () => {
    const { result, rerender } = renderHook(useBusyState, { wrapper: StrictMode })
    const [, setBusy, tryStart] = result.current
    act(() => {
      expect(tryStart()).toBe(true)
      expect(tryStart()).toBe(false)
      expect(tryStart()).toBe(false)
    })
    expect(result.current[0]).toBe(true)
    rerender()
    expect(result.current[1]).toBe(setBusy)
    expect(result.current[2]).toBe(tryStart)
    act(() => {
      setBusy(false)
      expect(tryStart()).toBe(true)
    })
  })

  it('keeps separate forms independent', () => {
    const first = renderHook(useBusyState)
    const second = renderHook(useBusyState)
    act(() => {
      expect(first.result.current[2]()).toBe(true)
      expect(second.result.current[2]()).toBe(true)
      first.result.current[1](false)
      expect(second.result.current[2]()).toBe(false)
    })
  })

  it.each(['success', 'failure'] as const)('blocks click and repeated form submit until %s, then permits retry', async (outcome) => {
    const request = deferred()
    const save = vi.fn().mockReturnValueOnce(request.promise).mockResolvedValue(undefined)
    const afterSave = vi.fn()
    const onError = vi.fn()

    function Form() {
      const [busy, setBusy, tryStart] = useBusyState()
      async function submit(event: FormEvent) {
        event.preventDefault()
        if (!tryStart()) return
        try {
          await save()
          afterSave()
        } catch (error) {
          onError(error)
        } finally {
          setBusy(false)
        }
      }
      return <form aria-label="record" onSubmit={submit}><button disabled={busy}>Save</button></form>
    }

    render(<StrictMode><Form /></StrictMode>)
    const form = screen.getByRole('form', { name: 'record' })
    const button = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement
    act(() => {
      fireEvent.click(button)
      for (let index = 0; index < 10; index += 1) fireEvent.submit(form)
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(button.disabled).toBe(true)
    await act(async () => {
      if (outcome === 'success') request.resolve()
      else request.reject(new Error('Network error'))
      await request.promise.catch(() => undefined)
    })
    expect(afterSave).toHaveBeenCalledTimes(outcome === 'success' ? 1 : 0)
    expect(onError).toHaveBeenCalledTimes(outcome === 'failure' ? 1 : 0)
    expect(button.disabled).toBe(false)
    await act(async () => { fireEvent.submit(form) })
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('holds the lock across a multi-step operation, including follow-up refresh', async () => {
    const { result } = renderHook(useBusyState)
    const upload = deferred()
    const refresh = deferred()
    const [, setBusy, tryStart] = result.current
    const run = async () => {
      if (!tryStart()) return
      try {
        await upload.promise
        await refresh.promise
      } finally { setBusy(false) }
    }
    let pending!: Promise<void>
    act(() => { pending = run() })
    await act(async () => { upload.resolve(); await upload.promise })
    act(() => { expect(tryStart()).toBe(false) })
    await act(async () => { refresh.resolve(); await pending })
    act(() => { expect(tryStart()).toBe(true) })
  })
})
