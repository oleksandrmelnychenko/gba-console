import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useBrowserBackGuard } from './useBrowserBackGuard'

function Guarded({ active, onBack }: { active: boolean; onBack: () => void }) {
  useBrowserBackGuard(active, onBack)
  return null
}

afterEach(() => vi.useRealTimers())

describe('useBrowserBackGuard', () => {
  it('asks instead of leaving on Back and keeps the guard entry', () => {
    const onBack = vi.fn()
    const before = window.history.length
    render(<Guarded active onBack={onBack} />)
    expect(window.history.length).toBe(before + 1)

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    })

    expect(onBack).toHaveBeenCalledOnce()
    expect((window.history.state as Record<string, unknown>).__gbaBackGuard).toBeTruthy()
  })

  it('does nothing while inactive', () => {
    const onBack = vi.fn()
    const before = window.history.length
    render(<Guarded active={false} onBack={onBack} />)

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    })

    expect(onBack).not.toHaveBeenCalled()
    expect(window.history.length).toBe(before)
  })
})
