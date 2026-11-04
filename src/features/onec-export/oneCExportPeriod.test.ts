import { describe, expect, it } from 'vitest'
import { resolveOneCExportPeriod, validateOneCExportPeriod } from './oneCExportPeriod'

const now = new Date('2026-11-03T23:30:00Z')
const custom = { from: '2026-10-05', to: '2026-10-20' }

describe('1C export period presets', () => {
  it('uses Kyiv business days for the presets', () => {
    expect(resolveOneCExportPeriod('today', custom, now)).toEqual({ from: '2026-11-04', to: '2026-11-04' })
    expect(resolveOneCExportPeriod('yesterday', custom, now)).toEqual({ from: '2026-11-03', to: '2026-11-03' })
    expect(resolveOneCExportPeriod('currentMonth', custom, now)).toEqual({ from: '2026-11-01', to: '2026-11-04' })
    expect(resolveOneCExportPeriod('previousMonth', custom, now)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })

  it('leaves the end open for an up-to-today export', () => {
    expect(resolveOneCExportPeriod('untilToday', custom, now)).toEqual({ from: '2026-10-05', to: null })
    expect(resolveOneCExportPeriod('custom', custom, now)).toEqual(custom)
  })

  it('rejects an inverted or malformed period', () => {
    expect(validateOneCExportPeriod({ from: '2026-10-05', to: null }, now)).toBeNull()
    expect(validateOneCExportPeriod({ from: '2026-11-05', to: null }, now)).toBe('Дата початку має бути не пізніше дати завершення')
    expect(validateOneCExportPeriod({ from: '2026-10-20', to: '2026-10-05' }, now)).toBe('Дата початку має бути не пізніше дати завершення')
    expect(validateOneCExportPeriod({ from: '', to: null }, now)).toBe('Вкажіть коректні дати періоду')
  })
})
