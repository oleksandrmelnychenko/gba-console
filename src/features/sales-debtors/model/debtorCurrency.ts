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

export type DebtorCurrencyField = 'RemainderDebt' | 'OverdueDebt' | 'TotalDebtInDays'

export function hasCurrencyBreakdown(debtor: ClientInDebt): boolean {
  return Array.isArray(debtor.CurrencyDebts)
}

export function getDebtorCurrencyAmounts(debtor: ClientInDebt, field: DebtorCurrencyField): CurrencyAmount[] {
  return toCurrencyAmounts(debtor.CurrencyDebts ?? [], (item) => item[field])
}

export function getDebtorEuroAmount(debtor: ClientInDebt, field: DebtorCurrencyField): number {
  if (field === 'RemainderDebt') {
    return toFiniteNumber(debtor.RemainderDebtEuro ?? debtor.RemainderDebt)
  }

  if (field === 'OverdueDebt') {
    return toFiniteNumber(debtor.OverdueDebtEuro ?? debtor.OverdueDebt)
  }

  return toFiniteNumber(debtor.TotalDebtInDaysEuro)
}

export function getSummaryCurrencyAmounts(
  totals: DebtorsCurrencyTotal[],
  field: 'RemainderDebt' | 'OverdueDebt',
): CurrencyAmount[] {
  return toCurrencyAmounts(totals, (item) => item[field])
}

export function getStructureCurrencyTotals(total: DebtorDebtTotal | null): DebtorDebtCurrencyTotal[] {
  if (!total) {
    return []
  }

  if (Array.isArray(total.Currencies)) {
    return total.Currencies.filter((item) => toFiniteNumber(item.Total) !== 0 || toFiniteNumber(item.TotalInEuro) !== 0)
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

export function formatCurrencyAmounts(amounts: CurrencyAmount[], format: (value: number) => string): string {
  return amounts.map((item) => `${format(item.amount)} ${item.currencyCode}`.trim()).join(' · ')
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
