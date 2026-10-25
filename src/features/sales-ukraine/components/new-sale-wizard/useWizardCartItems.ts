import { useMemo } from 'react'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../../types'

export const EMPTY_WIZARD_CART_ITEMS: SalesUkraineOrderItem[] = []

export function useWizardCartItems(sale: SalesUkraineSale | null): SalesUkraineOrderItem[] {
  const items = sale?.Order?.OrderItems
  return useMemo(() => getOrderItemsNewestFirst(items), [items])
}

function getOrderItemsNewestFirst(source: SalesUkraineOrderItem[] | undefined): SalesUkraineOrderItem[] {
  const items = Array.isArray(source) ? source : EMPTY_WIZARD_CART_ITEMS
  if (items.length === 0) return EMPTY_WIZARD_CART_ITEMS

  // Parse each Created once (Date.parse per comparator call is O(n log n) parses).
  return items
    .map((item) => [getCreatedTime(item), item] as const)
    .sort((a, b) => b[0] - a[0])
    .map(([, item]) => item)
}

function getCreatedTime(item: SalesUkraineOrderItem): number {
  const created = item.Created

  if (created instanceof Date) {
    return created.getTime()
  }

  if (typeof created === 'string') {
    const parsed = Date.parse(created)

    return Number.isNaN(parsed) ? 0 : parsed
  }

  return 0
}
