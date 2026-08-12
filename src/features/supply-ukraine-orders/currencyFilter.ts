import type { Currency } from './types'

export type SupplyOrderCurrencyFilterOption = {
  label: string
  value: string
}

export function buildSupplyOrderCurrencyFilterOptions(
  currencies: Currency[],
): SupplyOrderCurrencyFilterOption[] {
  return currencies.reduce<SupplyOrderCurrencyFilterOption[]>((options, currency) => {
    if (!isValidCurrencyId(currency.Id)) {
      return options
    }

    options.push({
      label: getCurrencyLabel(currency),
      value: String(currency.Id),
    })

    return options
  }, [])
}

export function normalizeSupplyOrderCurrencyFilterValue(value: unknown): string {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return ''
  }

  const currencyId = Number(value)
  return isValidCurrencyId(currencyId) ? String(currencyId) : ''
}

function getCurrencyLabel(currency: Currency): string {
  return [currency.Name, currency.Code].filter(Boolean).join(' - ') || String(currency.Id)
}

function isValidCurrencyId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}
