import { describe, expect, it } from 'vitest'
import { formatPlacementAddress, mergePlacementQuantities } from './placementAddress'

describe('formatPlacementAddress', () => {
  it('shows the default N-N-N placement as «Без розміщення»', () => {
    expect(formatPlacementAddress({ CellNumber: 'N', RowNumber: 'N', StorageNumber: 'N' })).toBe('Без розміщення')
  })

  it('joins a real address and skips empty values', () => {
    expect(formatPlacementAddress({ CellNumber: '3', RowNumber: '2', StorageNumber: 'A' })).toBe('A-2-3')
    expect(formatPlacementAddress({ StorageNumber: 'A' })).toBe('A')
    expect(formatPlacementAddress(null)).toBe('')
  })
})

describe('mergePlacementQuantities', () => {
  it('adds up repeated addresses such as two «Без розміщення» halves', () => {
    const placements = [
      { CellNumber: 'N', Qty: 0.5, RowNumber: 'N', StorageNumber: 'N' },
      { CellNumber: 'N', Qty: 0.5, RowNumber: 'N', StorageNumber: 'N' },
      { CellNumber: '3', Qty: 2, RowNumber: '2', StorageNumber: 'A' },
    ]

    expect(mergePlacementQuantities(placements, (entry) => entry, (entry) => entry.Qty)).toEqual([
      { address: 'Без розміщення', qty: 1 },
      { address: 'A-2-3', qty: 2 },
    ])
  })
})
