import { describe, expect, it } from 'vitest'
import { kyivContactDateToUtc } from './contactDate'

describe('Kyiv contact agreements', () => {
  it('converts summer and winter wall times explicitly', () => {
    expect(kyivContactDateToUtc('2026-10-22T12:30')).toBe('2026-10-22T09:30:00.000Z')
    expect(kyivContactDateToUtc('2026-12-22T12:30')).toBe('2026-12-22T10:30:00.000Z')
    expect(kyivContactDateToUtc('2026-10-25T04:30')).toBe('2026-10-25T02:30:00.000Z')
    expect(kyivContactDateToUtc('2026-10-22T00:15')).toBe('2026-10-21T21:15:00.000Z')
  })
  it.each(['2026-10-25T03:30', '2026-03-29T03:30'])('rejects ambiguous/nonexistent DST time %s', (value) => {
    expect(() => kyivContactDateToUtc(value)).toThrow('переведення годинника')
  })
  it.each(['2026-02-30T12:00', '', '2026-10-22', '2026-10-22T24:00', '2026-10-22T12:00Z'])('rejects invalid wall time %s', (value) => {
    expect(() => kyivContactDateToUtc(value)).toThrow('коректну дату')
  })
})
