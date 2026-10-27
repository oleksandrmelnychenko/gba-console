import type {
  ClientInDebt,
  DebtorDebtCurrencyTotal,
  DebtorDebtTotal,
  DebtorsCurrencyTotal,
} from '../types'
import { getKnownOverdueEuro, getKnownOverdueNative } from './debtorAging'

export const EURO_CURRENCY_CODE = 'EUR'

export type CurrencyAmount = {
  currencyCode: string
  amount: number
}

export type DebtorCurrencyField = 'RemainderDebt' | 'OverdueDebt' | 'TotalDebtInDays' | 'CreditBalance' | 'Advance' | 'NetBalance'

export function hasCurrencyBreakdown(debtor: ClientInDebt): boolean {
  return Array.isArray(debtor.CurrencyDebts)
}

export function getDebtorCurrencyAmounts(debtor: ClientInDebt, field: DebtorCurrencyField): CurrencyAmount[] {
  return toCurrencyAmounts(debtor.CurrencyDebts ?? [], (item) => field === 'OverdueDebt' ? getKnownOverdueNative(item, item.OverdueDebt) : item[field])
}

export function getDebtorEuroAmount(debtor: ClientInDebt, field: DebtorCurrencyField): number | null {
  if (field === 'RemainderDebt') {
    return toEuroAmount(debtor.RemainderDebtEuro !== undefined ? debtor.RemainderDebtEuro : debtor.RemainderDebt)
  }

  if (field === 'OverdueDebt') {
    return toEuroAmount(getKnownOverdueEuro(debtor, debtor.OverdueDebtEuro !== undefined ? debtor.OverdueDebtEuro : debtor.OverdueDebt))
  }

  if (field === 'CreditBalance') return toEuroAmount(debtor.CreditBalanceEuro)

  if (field === 'Advance') return toEuroAmount(debtor.AdvanceEuro)

  if (field === 'NetBalance') return debtor.NetBalanceEuro === undefined ? getDebtorEuroAmount(debtor, 'RemainderDebt') : toEuroAmount(debtor.NetBalanceEuro)

  return toEuroAmount(debtor.TotalDebtInDaysEuro)
}

export function getSummaryCurrencyAmounts(
  totals: DebtorsCurrencyTotal[],
  field: 'RemainderDebt' | 'OverdueDebt' | 'CreditBalance' | 'Advance' | 'NetBalance',
): CurrencyAmount[] {
  return toCurrencyAmounts(totals, (item) => field === 'OverdueDebt' ? getKnownOverdueNative(item, item.OverdueDebt) : item[field])
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
  label: 'Борг' | 'Борг, EUR' | 'Кредитовий залишок' | 'Кредитовий залишок, EUR' | 'Відоме прострочення' | 'Відоме прострочення, EUR'
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
  if (total.Aging !== undefined) {
    for (const item of currencies) {
      if ((item.Aging?.KnownOverdue ?? 0) > 0) lines.push({ label: 'Відоме прострочення', currencyCode: item.CurrencyCode || '', value: item.Aging?.KnownOverdue ?? null })
    }
    lines.push({ label: 'Відоме прострочення, EUR', currencyCode: EURO_CURRENCY_CODE, value: total.Aging?.KnownOverdueEuro ?? null })
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

export type EuroRateSource = { CurrencyCode?: string; EuroRate?: number | null; EuroRateDate?: string | null }

const rateFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 4, minimumFractionDigits: 2 })

export function getCurrentRateLabels(items: EuroRateSource[]): string[] {
  const labels = new Map<string, string>()
  for (const item of items) {
    const code = item.CurrencyCode?.trim() || ''
    if (!code || code === EURO_CURRENCY_CODE || labels.has(code) || item.EuroRate === undefined) continue
    const rate = typeof item.EuroRate === 'number' && Number.isFinite(item.EuroRate) && item.EuroRate > 0 ? item.EuroRate : null
    if (rate === null) {
      labels.set(code, `${code}: курс не визначено`)
      continue
    }
    const day = formatRateDate(item.EuroRateDate)
    labels.set(code, `${rateFormatter.format(rate)} ${code}/EUR${day ? ` на ${day}` : ''}`)
  }
  return [...labels.entries()].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)).map(([, label]) => label)
}

export function formatCurrentRateNote(items: EuroRateSource[]): string | null {
  const labels = getCurrentRateLabels(items)
  return labels.length > 0 ? `за поточним курсом ${labels.join(' · ')}` : null
}

export function hasForeignAdvance(items: Array<EuroRateSource & { AdvanceEuro?: number }>): boolean {
  return items.some((item) => (item.CurrencyCode?.trim() || '') !== EURO_CURRENCY_CODE && toFiniteNumber(item.AdvanceEuro) !== 0)
}

function formatRateDate(value?: string | null): string | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : null
}

function toCurrencyAmounts<TItem extends { CurrencyCode?: string }>(
  items: TItem[],
  pick: (item: TItem) => number | null | undefined,
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
