import type {
  ClientInDebt,
  DebtorDebtCurrencyTotal,
  DebtorDebtTotal,
  DebtorsCurrencyTotal,
} from '../types'

export const EURO_CURRENCY_CODE = 'EUR'

export type CurrencyAmount = {
  currencyCode: string
  amount: number
}

export type DebtorCurrencyField = 'RemainderDebt' | 'OverdueDebt' | 'TotalDebtInDays' | 'CreditBalance'

export function hasCurrencyBreakdown(debtor: ClientInDebt): boolean {
  return Array.isArray(debtor.CurrencyDebts)
}

export function getDebtorCurrencyAmounts(debtor: ClientInDebt, field: DebtorCurrencyField): CurrencyAmount[] {
  return toCurrencyAmounts(debtor.CurrencyDebts ?? [], (item) => item[field])
}

export function getDebtorEuroAmount(debtor: ClientInDebt, field: DebtorCurrencyField): number | null {
  if (field === 'RemainderDebt') {
    return toEuroAmount(debtor.RemainderDebtEuro !== undefined ? debtor.RemainderDebtEuro : debtor.RemainderDebt)
  }

  if (field === 'OverdueDebt') {
    return toEuroAmount(debtor.OverdueDebtEuro !== undefined ? debtor.OverdueDebtEuro : debtor.OverdueDebt)
  }

  if (field === 'CreditBalance') return toEuroAmount(debtor.CreditBalanceEuro)

  return toEuroAmount(debtor.TotalDebtInDaysEuro)
}

export function getSummaryCurrencyAmounts(
  totals: DebtorsCurrencyTotal[],
  field: 'RemainderDebt' | 'OverdueDebt' | 'CreditBalance',
): CurrencyAmount[] {
  return toCurrencyAmounts(totals, (item) => item[field])
}

export function getStructureCurrencyTotals(total: DebtorDebtTotal | null): DebtorDebtCurrencyTotal[] {
  if (!total) {
    return []
  }

  if (Array.isArray(total.Currencies)) {
    return total.Currencies.filter((item) =>
      toFiniteNumber(item.Total) !== 0 || item.TotalInEuro === null || toFiniteNumber(item.TotalInEuro) !== 0 ||
      toFiniteNumber(item.CreditBalance) !== 0 || item.CreditBalanceEuro === null || toFiniteNumber(item.CreditBalanceEuro) !== 0,
    )
  }

  const legacy: DebtorDebtCurrencyTotal[] = []

  if (toFiniteNumber(total.TotalEuro) !== 0) {
    legacy.push({ CurrencyCode: EURO_CURRENCY_CODE, Total: toFiniteNumber(total.TotalEuro), TotalInEuro: toFiniteNumber(total.TotalEuro) })
  }

  if (toFiniteNumber(total.TotalLocal) !== 0) {
    legacy.push({ CurrencyCode: '', Total: toFiniteNumber(total.TotalLocal) })
  }

  return legacy
}

export type DebtBalanceLine = {
  label: 'Борг' | 'Борг, EUR' | 'Кредитовий залишок' | 'Кредитовий залишок, EUR'
  currencyCode: string
  value: number | null
}

// Shared presentation for sale/payment cards that consume the same debt total endpoint.
export function getDebtBalanceLines(total: DebtorDebtTotal | null): DebtBalanceLine[] {
  if (!total) return []
  const currencies = getStructureCurrencyTotals(total)
  const lines: DebtBalanceLine[] = []
  for (const item of currencies) {
    if (toFiniteNumber(item.Total) !== 0) lines.push({ label: 'Борг', currencyCode: item.CurrencyCode || '', value: toFiniteNumber(item.Total) })
    if (toFiniteNumber(item.CreditBalance) !== 0) lines.push({ label: 'Кредитовий залишок', currencyCode: item.CurrencyCode || '', value: toFiniteNumber(item.CreditBalance) })
  }
  if (total.TotalInEuro !== undefined) lines.push({ label: 'Борг, EUR', currencyCode: EURO_CURRENCY_CODE, value: toEuroAmount(total.TotalInEuro) })
  if (total.CreditBalanceEuro !== undefined && (hasCreditBalance(total) || currencies.some(hasCreditBalance))) {
    lines.push({ label: 'Кредитовий залишок, EUR', currencyCode: EURO_CURRENCY_CODE, value: toEuroAmount(total.CreditBalanceEuro) })
  }
  return lines
}

export function formatCurrencyAmounts(amounts: CurrencyAmount[], format: (value: number) => string): string {
  return amounts.map((item) => `${format(item.amount)} ${item.currencyCode}`.trim()).join(' · ')
}

// Explicit null is an unknown valuation. Missing fields retain the legacy zero default.
export function toEuroAmount(value: number | null | undefined): number | null {
  if (value === undefined) return 0
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function formatDebtAmount(value: number | null | undefined, format: (amount: number) => string, unknownLabel: string): string {
  if (value === undefined) return '—'
  return typeof value === 'number' && Number.isFinite(value) ? format(value) : unknownLabel
}

export function hasCreditBalance(value: { CreditBalance?: number; CreditBalanceEuro?: number | null }): boolean {
  return toFiniteNumber(value.CreditBalance) > 0 || value.CreditBalanceEuro === null || toFiniteNumber(value.CreditBalanceEuro) > 0
}

export function toFiniteNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function toCurrencyAmounts<TItem extends { CurrencyCode?: string }>(
  items: TItem[],
  pick: (item: TItem) => number | undefined,
): CurrencyAmount[] {
  return items
    .map((item) => ({ amount: toFiniteNumber(pick(item)), currencyCode: item.CurrencyCode?.trim() || '' }))
    .filter((item) => item.amount !== 0)
    .sort(compareCurrencyAmounts)
}

function compareCurrencyAmounts(left: CurrencyAmount, right: CurrencyAmount): number {
  if (left.currencyCode === right.currencyCode) {
    return 0
  }

  return left.currencyCode < right.currencyCode ? -1 : 1
}
