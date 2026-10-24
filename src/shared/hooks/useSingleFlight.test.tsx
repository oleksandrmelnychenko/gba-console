import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSingleFlight } from './useSingleFlight'

describe('useSingleFlight', () => {
  it('runs the entire operation once and shares its result across rerenders', async () => {
    let complete!: (value: string) => void
    const request = new Promise<string>(resolve => { complete = resolve })
    const sideEffect = vi.fn()
    const action = vi.fn(async () => { const value = await request; sideEffect(); return value })
    const { result, rerender } = renderHook(useSingleFlight)
    const first = result.current('save', action)
    rerender()
    const second = result.current('save', action)
    expect(second).toBe(first)
    expect(action).toHaveBeenCalledTimes(1)
    complete('saved')
    await expect(first).resolves.toBe('saved')
    await expect(second).resolves.toBe('saved')
    expect(sideEffect).toHaveBeenCalledTimes(1)
    await result.current('save', action)
    expect(action).toHaveBeenCalledTimes(2)
  })

  it.each(['throw', 'reject'])('releases the action after %s and permits retry', async mode => {
    const { result } = renderHook(useSingleFlight)
    const error = new Error('Save failed')
    const action = vi.fn(() => {
      if (mode === 'throw') throw error
      return Promise.reject(error)
    })
    const first = result.current('save', action)
    const second = result.current('save', action)
    await expect(first).rejects.toBe(error)
    await expect(second).rejects.toBe(error)
    expect(action).toHaveBeenCalledTimes(1)
    await expect(result.current('save', () => Promise.resolve('retry'))).resolves.toBe('retry')
  })

  it('locks before synchronous side effects and leaves independent actions available', async () => {
    const { result } = renderHook(useSingleFlight)
    const duplicate = vi.fn(async () => 'duplicate')
    let reentrant!: Promise<string>
    const first = result.current('upload', async () => {
      reentrant = result.current('upload', duplicate)
      return 'uploaded'
    })
    expect(duplicate).not.toHaveBeenCalled()
    expect(reentrant).toBe(first)
    await expect(result.current('delete', async () => 'deleted')).resolves.toBe('deleted')
    await expect(first).resolves.toBe('uploaded')
  })

  it('does not share a lock between independently mounted editors', async () => {
    const first = renderHook(useSingleFlight)
    const second = renderHook(useSingleFlight)
    const action = vi.fn(async () => undefined)
    await act(async () => {
      await Promise.all([first.result.current('save', action), second.result.current('save', action)])
    })
    expect(action).toHaveBeenCalledTimes(2)
  })
})
