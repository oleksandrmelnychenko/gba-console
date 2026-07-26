import { describe, expect, it } from 'vitest'
import {
  INCOME_CASHFLOW_TEXT_LIMITS,
  validateIncomeCashflowContract,
  validateIncomeCashflowMovementName,
} from './incomeCashflowFormValidation'

const t = (value: string) => value

describe('income cash-flow form validation', () => {
  it('accepts VAT at the inclusive server boundaries', () => {
    expect(
      validateIncomeCashflowContract(
        {
          amount: 100,
          vatAmount: 100,
          vatRate: 100,
        },
        t,
      ),
    ).toBeNull()
  })

  it('rejects VAT outside the server contract', () => {
    expect(
      validateIncomeCashflowContract(
        {
          amount: 100,
          vatAmount: 10,
          vatRate: 100.01,
        },
        t,
      ),
    ).toBe('Ставка ПДВ має бути від 0 до 100')
    expect(
      validateIncomeCashflowContract(
        {
          amount: 100,
          vatAmount: 100.01,
          vatRate: 20,
        },
        t,
      ),
    ).toBe('Сума ПДВ має бути від нуля до суми платежу')
  })

  it.each([
    ['arrivalNumber', 'Вхідний номер'],
    ['comment', 'Коментар'],
    ['paymentPurpose', 'Призначення платежу'],
  ] as const)('enforces the %s text limit', (field, label) => {
    const maximumLength = INCOME_CASHFLOW_TEXT_LIMITS[field]

    expect(
      validateIncomeCashflowContract(
        {
          amount: 100,
          [field]: 'a'.repeat(maximumLength),
        },
        t,
      ),
    ).toBeNull()
    expect(
      validateIncomeCashflowContract(
        {
          amount: 100,
          [field]: 'a'.repeat(maximumLength + 1),
        },
        t,
      ),
    ).toBe(`${label}: не більше ${maximumLength} символів`)
  })

  it('rejects control characters accepted by multiline inputs', () => {
    expect(
      validateIncomeCashflowContract(
        {
          amount: 100,
          comment: 'Перший рядок\nДругий рядок',
        },
        t,
      ),
    ).toBe('Коментар: керівні символи не дозволені')
  })

  it('enforces the payment movement name limit before create', () => {
    expect(
      validateIncomeCashflowMovementName(
        'a'.repeat(INCOME_CASHFLOW_TEXT_LIMITS.movementName),
        t,
      ),
    ).toBeNull()
    expect(
      validateIncomeCashflowMovementName(
        'a'.repeat(INCOME_CASHFLOW_TEXT_LIMITS.movementName + 1),
        t,
      ),
    ).toBe('Стаття руху коштів: не більше 150 символів')
  })
})
