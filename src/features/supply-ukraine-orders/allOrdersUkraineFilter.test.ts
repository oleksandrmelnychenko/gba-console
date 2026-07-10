import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ALL_ORDERS_UKRAINE_FILTER_STORAGE_KEY,
  clearAllOrdersUkraineFilterAfterCreateState,
  createAllOrdersUkraineFilterAfterCreateState,
  createDefaultAllOrdersUkraineFilter,
  readAllOrdersUkraineFilter,
  readAllOrdersUkraineFilterAfterCreateState,
  resetAllOrdersUkraineFilter,
} from './allOrdersUkraineFilter'
import type { SupplyUkraineOrdersFilter } from './types'

const NOW = new Date(2026, 6, 10, 12)
const STALE_FILTERS: SupplyUkraineOrdersFilter = {
  currencyId: 'currency-1',
  from: '2026-06-29',
  supplier: 'Пилипенко',
  to: '2026-07-06',
  type: 'direct',
}

describe('all Ukraine orders filter persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('replaces stale persisted constraints with a current unfiltered range', () => {
    window.localStorage.setItem(ALL_ORDERS_UKRAINE_FILTER_STORAGE_KEY, JSON.stringify(STALE_FILTERS))

    const filters = resetAllOrdersUkraineFilter(NOW)

    expect(filters).toEqual({
      currencyId: '',
      from: '2026-07-03',
      supplier: '',
      to: '2026-07-10',
      type: 'all',
    })
    expect(readAllOrdersUkraineFilter(createDefaultAllOrdersUkraineFilter(NOW))).toEqual(filters)
  })

  it('carries the reset through mounted-list navigation exactly once', () => {
    const filters = createDefaultAllOrdersUkraineFilter(NOW)
    const backgroundLocation = { pathname: '/orders/ukraine/all' }
    const state = {
      ...createAllOrdersUkraineFilterAfterCreateState(filters),
      backgroundLocation,
    }

    expect(readAllOrdersUkraineFilterAfterCreateState(state)).toBe(filters)
    expect(clearAllOrdersUkraineFilterAfterCreateState(state)).toEqual({ backgroundLocation })
    expect(readAllOrdersUkraineFilterAfterCreateState(clearAllOrdersUkraineFilterAfterCreateState(state))).toBeNull()
  })
})
