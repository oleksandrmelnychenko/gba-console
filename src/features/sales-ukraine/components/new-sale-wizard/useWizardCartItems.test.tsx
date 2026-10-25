import { renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../../types'
import { useWizardCartItems } from './useWizardCartItems'

it('retains the sorted cart across sale-header changes and only sorts when items change', () => {
  const readCreated = vi.fn(() => '2026-10-20T10:00:00Z')
  const old: SalesUkraineOrderItem = { NetUid: 'old' }
  Object.defineProperty(old, 'Created', { get: readCreated })
  const recent: SalesUkraineOrderItem = { NetUid: 'recent', Created: '2026-10-21T10:00:00Z' }
  const items = [old, recent]
  const sale: SalesUkraineSale = { NetUid: 'sale', Order: { OrderItems: items } }
  const { result, rerender } = renderHook(useWizardCartItems, { initialProps: sale })
  expect(result.current).toEqual([recent, old])
  expect(items).toEqual([old, recent])
  const snapshot = result.current
  readCreated.mockClear()
  for (let i = 0; i < 20; i++) rerender({ ...sale, Comment: `Delivery ${i}`, Order: { ...sale.Order } })
  expect(result.current).toBe(snapshot)
  expect(readCreated).not.toHaveBeenCalled()
  const newest = { NetUid: 'newest', Created: '2026-10-22T10:00:00Z' }
  rerender({ ...sale, Order: { OrderItems: [...items, newest] } })
  expect(result.current).toEqual([newest, recent, old])
  expect(readCreated).toHaveBeenCalledOnce()
})

it('keeps empty carts stable and preserves source order for equal or missing timestamps', () => {
  const { result, rerender } = renderHook(useWizardCartItems, { initialProps: null as SalesUkraineSale | null })
  const empty = result.current
  rerender({ Order: { OrderItems: [] } })
  expect(result.current).toBe(empty)
  const items = [{ NetUid: 'first' }, { NetUid: 'second', Created: 'invalid' }, { NetUid: 'third' }]
  rerender({ Order: { OrderItems: items } })
  expect(result.current).toEqual(items)
})
