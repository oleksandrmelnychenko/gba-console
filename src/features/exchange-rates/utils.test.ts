import { describe, expect, it, vi } from 'vitest'
import { buildExchangeRateGroups, getDefaultFormDate } from './utils'
import type { ExchangeRatesSnapshot } from './types'

describe('exchange rate groups', () => {
  it('uses a single government update for PLN while keeping UAH batch updates', () => {
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
    expect(groups.find((group) => group.id === 'government-pln')?.updateMode).toBe('single-government')
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
})
