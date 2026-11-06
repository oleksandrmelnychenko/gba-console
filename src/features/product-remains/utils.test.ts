import { describe, expect, it } from 'vitest'
import { formatDateTime, getProductRemainMovementDefaultRange } from './utils'

describe('product remains utils', () => {
  it('formats SQL/ISO datetime strings without timezone shifting', () => {
    expect(formatDateTime('2026-06-10T14:05:33')).toBe('10.06.2026 14:05')
    expect(formatDateTime('2026-06-10 04:07:00')).toBe('10.06.2026 04:07')
  })

  it('keeps invalid datetime strings visible for diagnostics', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
  })

  it('opens the movement period from the batch date to Kyiv today', () => {
    const now = new Date('2026-11-05T23:30:00Z')

    expect(getProductRemainMovementDefaultRange('2026-03-14T00:00:00', now)).toEqual({
      dateFrom: '2026-03-14',
      dateTo: '2026-11-06',
    })
  })

  it('falls back to the start of the Kyiv month without a usable batch date', () => {
    const now = new Date('2026-11-05T23:30:00Z')

    expect(getProductRemainMovementDefaultRange(undefined, now)).toEqual({ dateFrom: '2026-11-01', dateTo: '2026-11-06' })
    expect(getProductRemainMovementDefaultRange('2026-12-01', now)).toEqual({ dateFrom: '2026-11-01', dateTo: '2026-11-06' })
    expect(getProductRemainMovementDefaultRange('not-a-date', now)).toEqual({ dateFrom: '2026-11-01', dateTo: '2026-11-06' })
  })
})
