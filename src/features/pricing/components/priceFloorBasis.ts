const floorPercent = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 1 })

function percent(value: number | null | undefined): string | null {
  return typeof value === 'number' && Number.isFinite(value) ? `${floorPercent.format(value)}\u00a0%` : null
}

export function describeFloorBasis(
  markupPct: number | null | undefined,
  marginPct: number | null | undefined,
): string | null {
  const markup = percent(markupPct)
  const margin = percent(marginPct)
  if (markup && margin) return `мінімальна ціна: націнка ${markup} на собівартість (маржа ${margin})`
  if (markup) return `мінімальна ціна: націнка ${markup} на собівартість`
  if (margin) return `мінімальна ціна: маржа ${margin}`
  return null
}
