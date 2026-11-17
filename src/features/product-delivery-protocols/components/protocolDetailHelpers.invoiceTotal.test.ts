import { describe, expect, it } from 'vitest'
import { getInvoiceTotalNetPrice } from './protocolDetailHelpers'

describe('getInvoiceTotalNetPrice', () => {
  it('shows the stored invoice amount when the detailed total was not hydrated', () => {
    // Детальні витрати showed 0,00 while Управління інвойсами showed 282 EUR.
    expect(getInvoiceTotalNetPrice({ NetPrice: 282, TotalNetPrice: 0 })).toBe(282)
  })

  it('prefers a hydrated detailed total and keeps a real zero', () => {
    expect(getInvoiceTotalNetPrice({ NetPrice: 282, TotalNetPrice: 300 })).toBe(300)
    expect(getInvoiceTotalNetPrice({ TotalNetPrice: 0 })).toBe(0)
  })
})
