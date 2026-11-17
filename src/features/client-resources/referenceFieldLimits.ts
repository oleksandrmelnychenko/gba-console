/** Column sizes of MeasureUnit and Currency on the server. */
export const MEASURE_UNIT_LIMITS = {
  codeOneCMaxLength: 25,
  nameMaxLength: 25,
} as const

export const CURRENCY_LIMITS = {
  codeMaxLength: 25,
  nameMaxLength: 150,
} as const

const CURRENCY_CODE_PATTERN = /^[A-Z0-9-]{2,25}$/

type Translate = (text: string) => string

export function validateMeasureUnitLimits(values: { CodeOneC: string; Name: string }, t: Translate): string | null {
  if (values.Name.trim().length > MEASURE_UNIT_LIMITS.nameMaxLength) {
    return t('Назва одиниці не може бути довшою за 25 символів')
  }

  if (values.CodeOneC.trim().length > MEASURE_UNIT_LIMITS.codeOneCMaxLength) {
    return t('Код 1С не може бути довшим за 25 символів')
  }

  return null
}

export function validateCurrencyLimits(values: { Code: string; Name: string }, t: Translate): string | null {
  if (values.Name.trim().length > CURRENCY_LIMITS.nameMaxLength) {
    return t('Назва валюти не може бути довшою за 150 символів')
  }

  if (!CURRENCY_CODE_PATTERN.test(values.Code.trim())) {
    return t('Код валюти: від 2 до 25 символів, лише латинські великі літери A–Z, цифри 0–9 та дефіс')
  }

  return null
}
