/** UKTZED (customs) codes are 4 to 10 digits; spaces people paste between groups are dropped. */
export const CUSTOMS_CODE_MAX_LENGTH = 10

export function normalizeCustomsCode(value: string): string {
  return value.replace(/\s+/g, '')
}

/**
 * Returns the field error or null. A 129-character value with markup used to reach the server,
 * which answered with the raw key "TextValueTooLong".
 */
export function validateCustomsCode(value: string, t: (key: string) => string): string | null {
  const code = normalizeCustomsCode(value)

  if (!code) {
    return `${t('Заповніть поле')} - ${t('Митний код')}`
  }

  return /^\d{4,10}$/.test(code) ? null : t('Митний код (УКТЗЕД) — від 4 до 10 цифр')
}
