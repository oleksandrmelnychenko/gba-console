/** Largest money amount the cash-order endpoints accept. */
export const MAX_CASH_ORDER_AMOUNT = 10_000_000_000

export interface ParsedAmount {
  /** Parsed number, or null when the text is empty or not a number. */
  value: number | null
  isNegative: boolean
  isInvalid: boolean
  decimals: number
}

/** Reads «1 234,56», «1234.56», «1234,» or «,5»; spaces (also non-breaking) are ignored. */
export function parseAmountText(text: string): ParsedAmount {
  // \s also covers non-breaking and narrow no-break spaces.
  const compact = text.replace(/\s/g, '')

  if (!compact) {
    return { decimals: 0, isInvalid: false, isNegative: false, value: null }
  }

  const isNegative = compact.startsWith('-')
  const unsigned = isNegative ? compact.slice(1) : compact
  const normalized = unsigned.replace(',', '.')

  if (!/^\d*\.?\d*$/.test(normalized) || normalized === '.' || normalized === '') {
    return { decimals: 0, isInvalid: true, isNegative, value: null }
  }

  const decimals = normalized.includes('.') ? normalized.length - normalized.indexOf('.') - 1 : 0
  const amount = Number(normalized)

  return {
    decimals,
    isInvalid: !Number.isFinite(amount),
    isNegative,
    value: Number.isFinite(amount) ? (isNegative ? -amount : amount) : null,
  }
}

export function getAmountError(
  parsed: ParsedAmount,
  { decimalScale = 2, max, maxMessage, min = 0 }: { decimalScale?: number; max?: number; maxMessage?: string; min?: number },
): string | null {
  if (parsed.isNegative) {
    return 'Від’ємне значення не допускається'
  }

  if (parsed.isInvalid) {
    return 'Введіть число, наприклад 1234,56'
  }

  if (parsed.value === null) {
    return null
  }

  if (parsed.decimals > decimalScale) {
    return decimalScale === 0
      ? 'Введіть ціле число'
      : `Не більше ${decimalScale} знаків після коми`
  }

  if (max !== undefined && parsed.value > max) {
    return maxMessage || `Не більше ${formatAmountText(max)}`
  }

  if (parsed.value < min) {
    return `Не менше ${formatAmountText(min)}`
  }

  return null
}

/** What the form receives: 0 for an empty, negative or unreadable text. */
export function toEmittedAmount(parsed: ParsedAmount): number {
  return parsed.isNegative || parsed.isInvalid || parsed.value === null ? 0 : parsed.value
}

export function toAmount(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const amount = typeof value === 'number' ? value : parseAmountText(value).value

  return amount === null || !Number.isFinite(amount) ? null : amount
}

export function formatAmountText(value: number | string | null | undefined): string {
  const amount = toAmount(value)

  // An untouched amount of 0 is shown empty, so typing does not append to «0».
  if (amount === null || amount === 0) {
    return ''
  }

  return String(amount).replace('.', ',')
}
