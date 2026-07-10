import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ALL_ORDERS_UKRAINE_FILTER_STORAGE_KEY,
  createDefaultAllOrdersUkraineFilter,
  readAllOrdersUkraineFilter,
  readAllOrdersUkraineFilterAfterCreateState,
} from './allOrdersUkraineFilter'
import { prepareSupplyUkraineOrderCreateNavigation } from './supplyUkraineOrderCreateSuccess'
import type { SupplyUkraineOrdersFilter } from './types'

const NOW = new Date(2026, 6, 10, 12)
const STALE_FILTERS: SupplyUkraineOrdersFilter = {
  currencyId: 'currency-1',
  from: '2026-06-29',
  supplier: 'Пилипенко',
  to: '2026-07-06',
  type: 'toUkraine',
}

describe('Ukraine order create success navigation', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(ALL_ORDERS_UKRAINE_FILTER_STORAGE_KEY, JSON.stringify(STALE_FILTERS))
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('resets list filters after a successful direct order creation', () => {
    const navigation = prepareSupplyUkraineOrderCreateNavigation(
      { SupplyOrder: { NetUid: 'direct-order-1' } },
      'direct',
      NOW,
    )

    expect(navigation?.path).toBe('/orders/ukraine/all/edit/direct-order-1')
    expect(readAllOrdersUkraineFilterAfterCreateState(navigation?.state)).toEqual({
      currencyId: '',
      from: '2026-07-03',
      supplier: '',
      to: '2026-07-10',
      type: 'all',
    })
    expect(readAllOrdersUkraineFilter(createDefaultAllOrdersUkraineFilter(NOW))).toEqual(
      readAllOrdersUkraineFilterAfterCreateState(navigation?.state),
    )
  })

  it('resets list filters after a successful Поставка creation', () => {
    const navigation = prepareSupplyUkraineOrderCreateNavigation(
      { SupplyOrderUkraine: { NetUid: 'receipt-1' } },
      'toUkraine',
      NOW,
    )

    expect(navigation?.path).toBe('/orders/ukraine/view/receipt-1')
    expect(readAllOrdersUkraineFilterAfterCreateState(navigation?.state)).toEqual({
      currencyId: '',
      from: '2026-07-03',
      supplier: '',
      to: '2026-07-10',
      type: 'all',
    })
  })

  it('carries reset filters when a successful response falls back directly to the list', () => {
    const navigation = prepareSupplyUkraineOrderCreateNavigation({}, 'direct', NOW)

    expect(navigation?.path).toBe('/orders/ukraine/all')
    expect(readAllOrdersUkraineFilterAfterCreateState(navigation?.state)).toEqual({
      currencyId: '',
      from: '2026-07-03',
      supplier: '',
      to: '2026-07-10',
      type: 'all',
    })
  })

  it('preserves persisted filters when the upload response has errors', () => {
    expect(prepareSupplyUkraineOrderCreateNavigation({ HasError: true }, 'direct', NOW)).toBeNull()
    expect(readAllOrdersUkraineFilter(createDefaultAllOrdersUkraineFilter(NOW))).toEqual(STALE_FILTERS)
  })
})
