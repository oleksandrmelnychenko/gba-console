import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearAuthReturnPath,
  consumeAuthReturnPath,
  markExplicitSignOut,
  rememberAuthReturnPath,
} from './authReturnPath'

function mockNavigationType(type: NavigationTimingType) {
  vi.spyOn(window.performance, 'getEntriesByType').mockReturnValue([{ type } as unknown as PerformanceEntry])
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  clearAuthReturnPath()
})

describe('login return path belongs to the session that lost it', () => {
  it('is honoured for the same user and not for another one', () => {
    rememberAuthReturnPath('/administration/vehicle-registry', 'USER-A')
    expect(consumeAuthReturnPath('/dashboard', 'user-a')).toBe('/administration/vehicle-registry')

    rememberAuthReturnPath('/administration/vehicle-registry', 'user-a')
    expect(consumeAuthReturnPath('/dashboard', 'user-b')).toBe('/dashboard')
    // Consumed either way: a later login does not get it.
    expect(consumeAuthReturnPath('/dashboard', 'user-a')).toBe('/dashboard')
  })

  it('expires after 30 minutes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-17T10:00:00Z'))
    rememberAuthReturnPath('/users/roles', 'user-a')
    vi.setSystemTime(new Date('2026-11-17T10:31:00Z'))

    expect(consumeAuthReturnPath('/dashboard', 'user-a')).toBe('/dashboard')
  })

  it('explicit sign-out forgets it, and a page reloaded by browser Back afterwards is not remembered', () => {
    rememberAuthReturnPath('/administration/vehicle-registry', 'user-a')
    markExplicitSignOut()
    expect(sessionStorage.getItem('gba:auth:return-path')).toBeNull()

    mockNavigationType('back_forward')
    rememberAuthReturnPath('/administration/vehicle-registry', 'user-a')
    expect(consumeAuthReturnPath('/dashboard', 'user-a')).toBe('/dashboard')
  })

  it('a link opened after sign-out is still a deep link, and login clears the sign-out mark', () => {
    markExplicitSignOut()
    mockNavigationType('navigate')
    rememberAuthReturnPath({ pathname: '/online-shop-cities', search: '?x=1' })

    expect(consumeAuthReturnPath('/dashboard', 'user-b')).toBe('/online-shop-cities?x=1')
    expect(sessionStorage.getItem('gba:auth:signed-out')).toBeNull()
  })
})
