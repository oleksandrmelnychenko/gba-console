import { isValidIban } from '../form/bankDetailsValidation'
import { isValidClientPhone } from '../form/validateClientForm'

export type ServicePayerFormValues = {
  LastName: string
  FirstName: string
  MiddleName: string
  MobilePhone: string
  PaymentAddress: string
  PaymentCard: string
  Comment: string
}

export type ServicePayerFormErrors = Partial<Record<'LastName' | 'MobilePhone' | 'PaymentCard', string>>

/** A 16-digit payment card (spaces/dashes allowed) whose Luhn checksum holds. */
export function isValidPaymentCard(value: string): boolean {
  const digits = value.replace(/[\s-]/g, '')
  if (!/^\d{16}$/.test(digits)) {
    return false
  }

  let sum = 0
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index])
    if (index % 2 === 1) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }
    sum += digit
  }

  return sum % 10 === 0
}

/**
 * Required fields get a message under the field (not a lone «*»); phone and card formats are
 * checked only when they differ from the loaded payer, so legacy values never block a save.
 */
export function validateServicePayer(
  values: ServicePayerFormValues,
  initial: ServicePayerFormValues,
  t: (value: string) => string,
): ServicePayerFormErrors {
  const phone = values.MobilePhone.trim()
  const card = values.PaymentCard.trim()
  const phoneChanged = phone !== initial.MobilePhone.trim()
  const cardChanged = card !== initial.PaymentCard.trim()

  return {
    LastName: !values.LastName.trim() ? t('Вкажіть прізвище') : undefined,
    MobilePhone: phone && phoneChanged && !isValidClientPhone(phone)
      ? t('Телефон: 10–15 цифр; дозволені пробіли, +, -, дужки')
      : undefined,
    PaymentCard: !card
      ? t('Вкажіть платіжну картку')
      : cardChanged && !isValidPaymentCard(card) && !isValidIban(card)
        ? t('Номер картки: 16 цифр з правильною контрольною сумою (або IBAN)')
        : undefined,
  }
}

export function hasServicePayerErrors(errors: ServicePayerFormErrors): boolean {
  return Boolean(errors.LastName || errors.MobilePhone || errors.PaymentCard)
}
