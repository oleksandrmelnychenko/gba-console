import { describe, expect, it } from 'vitest'
import { formatClientAgreementBalance } from './clientAgreementBalance'

const formatMoney = (value: number) => value.toFixed(2).replace('.', ',')

describe('formatClientAgreementBalance', () => {
  it('labels the stored EUR balance of a UAH agreement as EUR, not UAH', () => {
    // debts#3: 348,00 UAH advance is stored as 6.7969 and was shown «6,80 UAH».
    expect(formatClientAgreementBalance(6.7969, formatMoney)).toBe('6,80 EUR')
  })

  it('treats a missing amount as zero', () => {
    expect(formatClientAgreementBalance(undefined, formatMoney)).toBe('0,00 EUR')
  })
})
