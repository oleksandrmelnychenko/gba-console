import { describe, expect, it, vi } from 'vitest'
import {
  buildExchangeRateGroups,
  formatHistoryDate,
  getDefaultFormDate,
  getDefaultHistoryFromDate,
} from './utils'
import type { ExchangeRatesSnapshot } from './types'

describe('exchange rate groups', () => {
  it('uses batch government updates for both PLN and UAH', () => {
    const data: ExchangeRatesSnapshot = {
      commercial: [],
      commercialCross: [],
      government: [
        { Amount: 41.2, Code: 'USD', Culture: 'uk', NetUid: 'gov-uah-usd' },
        { Amount: 3.8, Code: 'USD', Culture: 'pl', NetUid: 'gov-pln-usd' },
      ],
      governmentCross: [],
    }

    const groups = buildExchangeRateGroups(data, {
      commercialCross: 'Крос',
      commercialPln: 'PLN',
      commercialUah: 'UAH',
      governmentCross: 'НБУ крос',
      governmentPln: 'НБУ PLN',
      governmentUah: 'НБУ UAH',
    })

    expect(groups.find((group) => group.id === 'government-uah')?.updateMode).toBe('batch-government')
    expect(groups.find((group) => group.id === 'government-pln')?.updateMode).toBe('batch-government')
  })

  it('uses the NBU daily timestamp for both UAH and PLN government forms', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-06T14:35:20'))

    try {
      expect(getDefaultFormDate('government-uah')).toEqual(new Date('2026-07-06T00:01:00'))
      expect(getDefaultFormDate('government-pln')).toEqual(new Date('2026-07-06T00:01:00'))
    } finally {
      vi.useRealTimers()
    }
  })

  it('opens history with a useful 30-day window instead of today only', () => {
    expect(getDefaultHistoryFromDate(new Date('2026-07-30T18:45:12'))).toEqual(
      new Date('2026-06-30T00:00:00'),
    )
  })

  it('shows synchronized daily rates without a misleading midnight time', () => {
    expect(formatHistoryDate('2026-08-18T00:00:00')).toBe('18.08.2026')
  })

  it('keeps the actual time for intraday rate changes', () => {
    expect(formatHistoryDate('2026-08-18T14:25:00')).toBe('18.08.2026, 14:25')
  })

  it('does not render invalid or missing history dates', () => {
    expect(formatHistoryDate()).toBe('')
    expect(formatHistoryDate('not-a-date')).toBe('')
  })
})
