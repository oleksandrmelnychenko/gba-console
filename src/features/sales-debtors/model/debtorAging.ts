import type { DebtAging, DebtCurrencyAging, DebtorDebt } from '../types'

export type AgingSource = { Aging?: DebtAging | null }
export type AgingCurrencySource = { CurrencyCode?: string; Aging?: DebtCurrencyAging | null }

export function getKnownOverdueEuro(source: AgingSource, legacy: number | null | undefined): number | null | undefined {
  return source.Aging === undefined ? legacy : source.Aging?.KnownOverdueEuro ?? null
}

export function getKnownOverdueNative(source: AgingCurrencySource, legacy: number | null | undefined): number | null | undefined {
  return source.Aging === undefined ? legacy : source.Aging?.KnownOverdue ?? null
}

export function getKnownAgingDays(aging: DebtAging | null | undefined): number | null {
  const days = aging?.MaxKnownDaysPastDue
  return typeof days === 'number' && Number.isFinite(days) ? Math.max(0, days) : null
}

export function getMaximumKnownAgingDays(agings: Array<DebtAging | null | undefined>): number | null {
  let maximum: number | null = null
  for (const aging of agings) {
    const days = getKnownAgingDays(aging)
    if (days !== null) maximum = maximum === null ? days : Math.max(maximum, days)
  }
  return maximum
}

export function hasIncompleteAging(aging: DebtAging | null | undefined): boolean {
  return aging !== undefined && aging?.HasCompleteAging !== true
}

export function getAgingUnknownCount(aging: DebtAging | null | undefined): number {
  return (aging?.UnknownDateDebtCount ?? 0) + (aging?.UnknownTermsDebtCount ?? 0)
}

export function getAgingDateLabel(value: string | undefined): string | null {
  // This is a Kyiv business DATE from the API, not an instant to convert in the browser's timezone.
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : null
}

export function getGroupedDebtAging(debt: DebtorDebt | null | undefined) {
  const canonical = debt?.Aging !== undefined
  const overdueTotal = getKnownOverdueNative({ Aging: debt?.Aging }, debt?.OverdueTotal)
  return {
    canonical,
    overdueTotal,
    overdueEuro: getKnownOverdueEuro({ Aging: debt?.Aging }, debt?.OverdueEuroTotal),
    days: canonical ? getKnownAgingDays(debt?.Aging) : debt?.Days ?? null,
    incomplete: hasIncompleteAging(debt?.Aging),
    knownOverdue: (overdueTotal ?? 0) > 0,
  }
}
