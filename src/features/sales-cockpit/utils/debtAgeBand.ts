const DEBT_FRESH_MAX_DAYS = 30
const DEBT_AGED_MAX_DAYS = 90

export function debtAgeBandLabel(debt: unknown): string | null {
  if (!debt || typeof debt !== 'object') return null
  const { age_band: band, grace_days: grace } = debt as { age_band?: unknown; grace_days?: unknown }
  const from = typeof grace === 'number' && Number.isInteger(grace) && grace >= 0 && grace < DEBT_FRESH_MAX_DAYS ? grace + 1 : 4
  if (band === 'fresh') return `${from}–${DEBT_FRESH_MAX_DAYS} днів`
  if (band === 'aged') return `${DEBT_FRESH_MAX_DAYS + 1}–${DEBT_AGED_MAX_DAYS} днів`
  if (band === 'old') return `понад ${DEBT_AGED_MAX_DAYS} днів`
  return null
}
