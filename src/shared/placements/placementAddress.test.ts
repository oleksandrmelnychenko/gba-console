import { describe, expect, it } from 'vitest'
import { formatPlacementAddress } from './placementAddress'

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
