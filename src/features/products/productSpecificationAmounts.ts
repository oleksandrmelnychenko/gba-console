export const SPECIFICATION_AMOUNT_MAX = 1_000_000_000

export type SpecificationAmountResult = { error: string | null; value: number | undefined }

/**
 * Митна вартість / Мито / ПДВ: empty, or a finite non-negative number up to 1 000 000 000.
 * Anything else is reported instead of being silently clamped or dropped.
 */
export function parseSpecificationAmount(value: number | string, t: (value: string) => string): SpecificationAmountResult {
  if (typeof value === 'string' && !value.trim()) {
    return { error: null, value: undefined }
  }

  const amount = typeof value === 'number' ? value : Number(value.replace(',', '.').replace(/\s+/g, ''))

  if (!Number.isFinite(amount)) {
    return { error: t('Вкажіть число'), value: undefined }
  }

  if (amount < 0) {
    return { error: t('Значення не може бути відʼємним'), value: undefined }
  }

  if (amount > SPECIFICATION_AMOUNT_MAX) {
    return { error: t('Занадто велике значення (максимум 1 000 000 000)'), value: undefined }
  }

  return { error: null, value: amount }
}
