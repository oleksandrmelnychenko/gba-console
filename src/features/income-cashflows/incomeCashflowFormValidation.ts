export const INCOME_CASHFLOW_TEXT_LIMITS = {
  arrivalNumber: 450,
  comment: 450,
  movementName: 150,
  paymentPurpose: 450,
} as const

type Translate = (value: string) => string

type IncomeCashflowContractValues = {
  amount: number
  arrivalNumber?: string
  comment?: string
  paymentPurpose?: string
  vatAmount?: number
  vatRate?: number
}

export function validateIncomeCashflowContract(
  values: IncomeCashflowContractValues,
  t: Translate,
): string | null {
  if (
    values.vatRate !== undefined &&
    (!Number.isFinite(values.vatRate) ||
      values.vatRate < 0 ||
      values.vatRate > 100)
  ) {
    return t('Ставка ПДВ має бути від 0 до 100')
  }

  if (
    values.vatAmount !== undefined &&
    (!Number.isFinite(values.vatAmount) ||
      values.vatAmount < 0 ||
      values.vatAmount > values.amount)
  ) {
    return t('Сума ПДВ має бути від нуля до суми платежу')
  }

  return (
    validateIncomeCashflowText(
      values.arrivalNumber,
      t('Вхідний номер'),
      INCOME_CASHFLOW_TEXT_LIMITS.arrivalNumber,
      t,
    ) ||
    validateIncomeCashflowText(
      values.comment,
      t('Коментар'),
      INCOME_CASHFLOW_TEXT_LIMITS.comment,
      t,
    ) ||
    validateIncomeCashflowText(
      values.paymentPurpose,
      t('Призначення платежу'),
      INCOME_CASHFLOW_TEXT_LIMITS.paymentPurpose,
      t,
    )
  )
}

export function validateIncomeCashflowMovementName(
  value: string,
  t: Translate,
): string | null {
  return validateIncomeCashflowText(
    value,
    t('Стаття руху коштів'),
    INCOME_CASHFLOW_TEXT_LIMITS.movementName,
    t,
  )
}

function validateIncomeCashflowText(
  value: string | undefined,
  label: string,
  maximumLength: number,
  t: Translate,
): string | null {
  const normalizedValue = value?.trim() || ''

  if (normalizedValue.length > maximumLength) {
    return `${label}: ${t('не більше')} ${maximumLength} ${t('символів')}`
  }

  if (hasControlCharacter(normalizedValue)) {
    return `${label}: ${t('керівні символи не дозволені')}`
  }

  return null
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) || 0

    if (codePoint <= 31 || (codePoint >= 127 && codePoint <= 159)) {
      return true
    }
  }

  return false
}
