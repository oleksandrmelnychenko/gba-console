import { describe, expect, it } from 'vitest'
import { formatWriteOffMoney, sumWriteOffAmounts } from './depreciatedOrderAmounts'

describe('write-off amounts', () => {
  it('sums the loaded acts and formats like the console', () => {
    expect(sumWriteOffAmounts([{ Amount: 1200.5 }, { Amount: 99.5 }, {}])).toBe(1300)
    expect(sumWriteOffAmounts([{}])).toBeNull()
    expect(formatWriteOffMoney(1300).replace(/\s/g, ' ')).toBe('1 300,00')
  })
})
