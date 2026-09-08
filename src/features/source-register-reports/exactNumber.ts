import type { ExactRegisterNumber } from './types'

const SCALES = Array.from({ length: 39 }, (_, index) => String(index))
const COEFFICIENT = /^(?:0|-?[1-9][0-9]*)$/

/** Bound and validate the normalized string pair without converting an amount to floating point. */
export function isExactRegisterNumber(value: unknown, maximumDigits = 174): value is ExactRegisterNumber {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== 2 || typeof record.coefficient !== 'string' || typeof record.scale !== 'string') return false
  const { coefficient, scale } = record
  const digits = coefficient.startsWith('-') ? coefficient.slice(1) : coefficient
  return digits.length <= maximumDigits && COEFFICIENT.test(coefficient) && SCALES.includes(scale)
    && (coefficient !== '0' || scale === '0') && (scale === '0' || !coefficient.endsWith('0'))
}

/** Exact decimal insertion only: no rounding, arithmetic or Number/parseFloat conversion. */
export function formatExactRegisterNumber(value: ExactRegisterNumber): string {
  if (!isExactRegisterNumber(value)) throw new Error('Некоректне точне числове значення звіту.')
  const scale = SCALES.indexOf(value.scale)
  if (scale === 0) return value.coefficient
  const negative = value.coefficient.startsWith('-')
  const digits = (negative ? value.coefficient.slice(1) : value.coefficient).padStart(scale + 1, '0')
  return `${negative ? '-' : ''}${digits.slice(0, -scale)},${digits.slice(-scale)}`
}

export function registerScaleIndex(value: string): number { return SCALES.indexOf(value) }
