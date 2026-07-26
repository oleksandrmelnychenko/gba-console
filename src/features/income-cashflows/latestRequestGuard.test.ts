import { describe, expect, it } from 'vitest'
import { createLatestRequestGuard } from './latestRequestGuard'

describe('latest request guard', () => {
  it('prevents an A response from replacing a newer B selection', () => {
    const guard = createLatestRequestGuard<string>()
    const requestA = guard.start('A')
    const requestB = guard.start('B')

    expect(guard.isCurrent(requestA)).toBe(false)
    expect(guard.isCurrent(requestB)).toBe(true)
    expect(guard.finish(requestA)).toBe(false)
    expect(guard.isActive('B')).toBe(true)
  })

  it('clears the active key after success or error completion', () => {
    const guard = createLatestRequestGuard<string>()
    const request = guard.start('order-1')

    expect(guard.finish(request)).toBe(true)
    expect(guard.isActive('order-1')).toBe(false)
    expect(guard.start('order-1')).not.toBe(request)
  })

  it('clears an aborted selection without reviving its stale token', () => {
    const guard = createLatestRequestGuard<string>()
    const abortedRequest = guard.start('A')

    guard.invalidate()

    expect(guard.isCurrent(abortedRequest)).toBe(false)
    expect(guard.isActive('A')).toBe(false)
    expect(guard.finish(abortedRequest)).toBe(false)
  })
})
