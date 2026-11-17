import { describe, expect, it } from 'vitest'
import { consumeOwnSupplyOrderEcho, expectOwnSupplyOrderEcho } from './ownSupplyOrderEcho'

describe('own supply order echo', () => {
  it('skips one broadcast right after our own save, then toasts again', () => {
    expectOwnSupplyOrderEcho(8000, 1000)
    expect(consumeOwnSupplyOrderEcho(2000)).toBe(true)
    expect(consumeOwnSupplyOrderEcho(2100)).toBe(false)
  })

  it('does not hide broadcasts once the window has passed', () => {
    expectOwnSupplyOrderEcho(8000, 1000)
    expect(consumeOwnSupplyOrderEcho(9500)).toBe(false)
  })
})
