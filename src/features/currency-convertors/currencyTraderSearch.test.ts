import { describe, expect, it } from 'vitest'
import type { CurrencyTrader } from './types'
import { filterCurrencyTraders } from './currencyTraderSearch'

const traders: CurrencyTrader[] = [
  {
    Id: 11,
    NetUid: 'trader-olena',
    FirstName: 'Олена',
    LastName: 'Коваль',
    MiddleName: 'Іванівна',
    PhoneNumber: '+380 67 123 45 67',
  },
  {
    Id: 22,
    NetUid: 'trader-andrii',
    FirstName: 'Андрій',
    LastName: 'Мельник',
    MiddleName: 'Петрович',
    PhoneNumber: '+380 50 765 43 21',
  },
]

describe('filterCurrencyTraders', () => {
  it('keeps the full list for an empty search', () => {
    expect(filterCurrencyTraders(traders, '   ')).toBe(traders)
  })

  it.each([
    ['коваль', 'trader-olena'],
    ['ОЛЕНА КОВАЛЬ', 'trader-olena'],
    ['андрій петрович мельник', 'trader-andrii'],
    ['765 43', 'trader-andrii'],
    ['380507654321', 'trader-andrii'],
  ])('matches "%s" across trader fields', (searchValue, expectedNetUid) => {
    expect(filterCurrencyTraders(traders, searchValue).map((trader) => trader.NetUid)).toEqual([expectedNetUid])
  })

  it('returns an empty list when no trader matches', () => {
    expect(filterCurrencyTraders(traders, 'невідомий')).toEqual([])
  })
})
