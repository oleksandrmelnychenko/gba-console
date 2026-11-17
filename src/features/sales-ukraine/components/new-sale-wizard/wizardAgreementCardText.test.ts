import { describe, expect, it } from 'vitest'
import { describeCreditLimit, formatAgreementMoney } from './wizardAgreementCardText'

const nbsp = (value: string) => value.replace(/(\d) (\d)/g, '$1 $2')

describe('wizard agreement card text', () => {
  it('prints every amount with its unit', () => {
    expect(formatAgreementMoney(15.1909, 'EUR')).toBe('15,19 EUR')
    expect(formatAgreementMoney(null, 'UAH')).toBe('Не визначено')
  })

  it('says what limit is saved when control is off, and the enforced limit when on', () => {
    expect(describeCreditLimit({ AmountDebt: 100000, NumberDaysDebt: 30 }, null, 'UAH'))
      .toBe(nbsp('100 000,00 UAH / 30 дн. (контроль вимкнено)'))
    expect(describeCreditLimit({ AmountDebt: 0, NumberDaysDebt: 0 }, null, 'UAH')).toBe('Ліміт не налаштовано')
    expect(describeCreditLimit({ AmountDebt: 1000, NumberDaysDebt: 7, IsControlAmountDebt: true, IsControlNumberDaysDebt: true }, 1000, 'UAH'))
      .toBe(nbsp('1 000,00 UAH / 7 дн.'))
  })
})
