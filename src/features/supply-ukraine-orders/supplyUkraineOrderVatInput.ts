export function toPercentNumber(value: string | number, decimalPlaces: number): number {
  const parsedValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(parsedValue)) {
    return 0
  }

  const clampedValue = Math.min(Math.max(parsedValue, 0), 100)
  const multiplier = 10 ** decimalPlaces

  return Math.round(clampedValue * multiplier) / multiplier
}

export function parseOrderVatPercentInput(value: string | number): number | undefined {
  return value === '' ? undefined : toPercentNumber(value, 0)
}
