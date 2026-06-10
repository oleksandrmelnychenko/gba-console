import { describe, expect, it } from 'vitest'
import { formatDateTime } from './utils'

describe('product remains utils', () => {
  it('formats SQL/ISO datetime strings without timezone shifting', () => {
    expect(formatDateTime('2026-06-10T14:05:33')).toBe('10.06.2026 14:05')
    expect(formatDateTime('2026-06-10 04:07:00')).toBe('10.06.2026 04:07')
  })

  it('keeps invalid datetime strings visible for diagnostics', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
  })
})
