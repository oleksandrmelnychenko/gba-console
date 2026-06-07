import { describe, expect, it } from 'vitest'
import {
  getDirectSupplyOrderDisplayNumber,
  getSupplyUkraineOrderDisplayNumber,
  normalizeDisplayNumber,
} from './supplyUkraineOrderNumbers'

describe('supply Ukraine order number helpers', () => {
  it('hides blank and all-zero numbers', () => {
    expect(normalizeDisplayNumber('')).toBeUndefined()
    expect(normalizeDisplayNumber(' 00000000000 ')).toBeUndefined()
    expect(normalizeDisplayNumber(' 12345 ')).toBe('12345')
  })

  it('falls back through direct supply order business numbers', () => {
    expect(getDirectSupplyOrderDisplayNumber({
      SupplyOrderNumber: { Number: '00000000000' },
      SupplyProForm: { Number: 'PF-10' },
      SupplyInvoices: [{ Number: 'INV-1' }],
    })).toBe('PF-10')

    expect(getDirectSupplyOrderDisplayNumber({
      SupplyInvoices: [{ Number: '0000' }, { Number: 'INV-2' }],
    })).toBe('INV-2')
  })

  it('does not use direct supply order NetUid as a display number', () => {
    expect(getDirectSupplyOrderDisplayNumber({
      SupplyOrderNumber: { Number: '00000000000' },
    })).toBeUndefined()
  })

  it('keeps Ukraine order NetUid fallback for Ukraine order rows', () => {
    expect(getSupplyUkraineOrderDisplayNumber({
      InvNumber: '0000',
      NetUid: 'order-net-id',
      Number: '00000000000',
    })).toBe('order-net-id')
  })
})
