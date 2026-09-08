export function toCents(value: number): bigint {
  return roundDecimalToScale(decimalParts(value), 2)
}

/** Compare canonical JSON decimals without rounding a fractional budget to cents. */
export function compareDecimals(left: number, right: number): number {
  const a = decimalParts(left), b = decimalParts(right), scale = Math.max(a.scale, b.scale)
  const difference = a.coefficient * 10n ** BigInt(scale - a.scale) - b.coefficient * 10n ** BigInt(scale - b.scale)
  return difference < 0n ? -1 : difference > 0n ? 1 : 0
}

export function multiplyToCents(left: number, right: number): bigint {
  // The service calculates money with Decimal ROUND_HALF_UP. Multiplying the
  // parsed JSON numbers as IEEE-754 values makes valid half-cent ties (4.975)
  // drift below the boundary, so multiply their decimal coefficients instead.
  const leftParts = decimalParts(left)
  const rightParts = decimalParts(right)

  return roundDecimalToScale(
    {
      coefficient: leftParts.coefficient * rightParts.coefficient,
      scale: leftParts.scale + rightParts.scale,
    },
    2,
  )
}

/** Preserve the service's canonical decimal cents; an unsupported numeric extension remains unknown. */
export function exactDisplayedLineAmount(unit: number, quantity: number): number | null {
  const cents = multiplyToCents(unit, quantity)
  const value = Number(`${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`)
  if (!Number.isFinite(value)) return null
  const actual = decimalParts(value), scale = Math.max(2, actual.scale)
  return cents * 10n ** BigInt(scale - 2) === actual.coefficient * 10n ** BigInt(scale - actual.scale) ? value : null
}

export function decimalParts(value: number): { coefficient: bigint; scale: number } {
  if (!Number.isFinite(value)) {
    throw new TypeError('Cannot convert a non-finite number to decimal parts')
  }

  const [mantissa, exponentPart] = value.toString().toLowerCase().split('e')
  const exponent = exponentPart === undefined ? 0 : Number(exponentPart)
  const negative = mantissa.startsWith('-')
  const unsignedMantissa = negative ? mantissa.slice(1) : mantissa
  const [integerPart, fractionPart = ''] = unsignedMantissa.split('.')
  const digits = `${integerPart}${fractionPart}`.replace(/^0+(?=\d)/, '') || '0'
  let coefficient = BigInt(digits)
  let scale = fractionPart.length - exponent

  if (negative) {
    coefficient = -coefficient
  }
  if (scale < 0) {
    coefficient *= 10n ** BigInt(-scale)
    scale = 0
  }

  return { coefficient, scale }
}

export function roundDecimalToScale(
  value: { coefficient: bigint; scale: number },
  targetScale: number,
): bigint {
  if (value.scale <= targetScale) {
    return value.coefficient * 10n ** BigInt(targetScale - value.scale)
  }

  const divisor = 10n ** BigInt(value.scale - targetScale)
  const quotient = value.coefficient / divisor
  const remainder = value.coefficient % divisor
  const absoluteRemainder = remainder < 0n ? -remainder : remainder

  if (absoluteRemainder * 2n < divisor) {
    return quotient
  }

  return quotient + (value.coefficient < 0n ? -1n : 1n)
}
