import { describe, expect, it } from 'vitest'
import { isValidPaymentCard, validateServicePayer, type ServicePayerFormValues } from './servicePayerValidation'

const t = (value: string) => value
const empty: ServicePayerFormValues = {
  LastName: '', FirstName: '', MiddleName: '', MobilePhone: '', PaymentAddress: '', PaymentCard: '', Comment: '',
}

describe('service payer validation', () => {
  it('checks the card Luhn sum', () => {
    expect(isValidPaymentCard('4111 1111 1111 1111')).toBe(true)
    expect(isValidPaymentCard('4111111111111112')).toBe(false)
    expect(isValidPaymentCard('abc')).toBe(false)
  })

  it('says what is missing under each required field', () => {
    expect(validateServicePayer(empty, empty, t)).toEqual({
      LastName: 'Вкажіть прізвище',
      MobilePhone: undefined,
      PaymentCard: 'Вкажіть платіжну картку',
    })
  })

  it('rejects a text phone and card, accepts an IBAN, and leaves a loaded legacy card alone', () => {
    const typed = { ...empty, LastName: 'Платник', MobilePhone: 'abc', PaymentCard: 'abc' }
    expect(validateServicePayer(typed, empty, t)).toMatchObject({
      MobilePhone: 'Телефон: 10–15 цифр; дозволені пробіли, +, -, дужки',
      PaymentCard: 'Номер картки: 16 цифр з правильною контрольною сумою (або IBAN)',
    })
    expect(validateServicePayer({ ...typed, MobilePhone: '', PaymentCard: 'UA213223130000026007233566001' }, empty, t).PaymentCard)
      .toBeUndefined()
    const legacy = { ...empty, LastName: 'Платник', PaymentCard: 'Рахунок 1С' }
    expect(validateServicePayer(legacy, legacy, t).PaymentCard).toBeUndefined()
  })
})
