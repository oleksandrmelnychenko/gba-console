import { describe, expect, it } from 'vitest'
import { financialTotal } from './financials'
const row = (gross: string, returned = '0', unresolved: number | null = 0) => ({ revenue_eur: gross, known_returned_value_eur: returned, unresolved_amount_count: unresolved })
describe('canonical assortment totals', () => {
  it('rounds additive source amounts once, including negative half cents', () => {
    expect(financialTotal([row('1.005'), row('1.005')], false)).toBe(2.01)
    expect(financialTotal([row('-1.005')], true)).toBe(-1.01)
    expect(financialTotal([row('0', '20.125')], true)).toBe(-20.13)
  })
  it('keeps unknown net totals unknown while gross remains available', () => {
    expect(financialTotal([row('20', '3', 1)], true)).toBeNull()
    expect(financialTotal([row('20', '3', 1)], false)).toBe(20)
    expect(financialTotal([row('20', '3', null)], true)).toBeNull()
  })
  it('rejects malformed and unsafe amount bases', () => {
    expect(financialTotal([row('NaN')], false)).toBeNull()
    expect(financialTotal([row('900719925474099200')], false)).toBeNull()
  })
})
