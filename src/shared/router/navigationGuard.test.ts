import { describe, expect, it, vi } from 'vitest'
import { runGuardedNavigation, setNavigationGuard } from './navigationGuard'

describe('navigationGuard', () => {
  it('navigates immediately when no guard is registered', () => {
    const proceed = vi.fn()
    runGuardedNavigation(proceed)
    expect(proceed).toHaveBeenCalledTimes(1)
  })

  it('lets the active guard hold the navigation and resume it later', () => {
    let held: (() => void) | null = null
    const release = setNavigationGuard((proceed) => {
      held = proceed
      return true
    })
    const proceed = vi.fn()

    runGuardedNavigation(proceed)
    expect(proceed).not.toHaveBeenCalled()

    held!()
    expect(proceed).toHaveBeenCalledTimes(1)
    release()
  })

  it('stops guarding after release and ignores a stale release', () => {
    const first = setNavigationGuard(() => true)
    const second = setNavigationGuard(() => true)
    first()

    const blocked = vi.fn()
    runGuardedNavigation(blocked)
    expect(blocked).not.toHaveBeenCalled()

    second()
    const passed = vi.fn()
    runGuardedNavigation(passed)
    expect(passed).toHaveBeenCalledTimes(1)
  })
})
