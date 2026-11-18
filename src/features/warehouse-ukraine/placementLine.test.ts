import { describe, expect, it } from 'vitest'
import { formatOrderPlacementLine } from './placementLine'

/* WH2-24: order placements read like the storages page, not «N-N-N - 5». */
describe('order placement line', () => {
  it('shows the default no-location placement as «Без розміщення»', () => {
    expect(formatOrderPlacementLine({ CellNumber: 'N', Qty: 5, RowNumber: 'N', StorageNumber: 'N' })).toBe('Без розміщення. Кількість 5')
  })

  it('shows a real address as a position with a decimal comma', () => {
    expect(formatOrderPlacementLine({ CellNumber: '2', Qty: 1.5, RowNumber: '1', StorageNumber: 'A' })).toBe('Позиція A-1-2. Кількість 1,5')
  })

  it('never prints the raw «N-N-N - qty» form', () => {
    expect(formatOrderPlacementLine({ CellNumber: 'N', Qty: 2, RowNumber: 'N', StorageNumber: 'N' })).not.toContain('N-N-N')
  })
})
