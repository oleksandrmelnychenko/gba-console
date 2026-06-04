import type { SalesUkraineSale } from './types'

export const BASE_CURRENCY_CODE = 'EUR'
export const CONVERTED_CURRENCY_CODE = 'UAH'

export function getSaleCurrencyCode(sale: SalesUkraineSale | null | undefined): string {
  return sale?.ClientAgreement?.Agreement?.Currency?.Code || ''
}

export function isNonVatEurSale(sale: SalesUkraineSale | null | undefined): boolean {
  return Boolean(sale && !sale.ClientAgreement?.Agreement?.WithVATAccounting) && getSaleCurrencyCode(sale) === BASE_CURRENCY_CODE
}

export function getSaleLocalCurrencyCode(sale: SalesUkraineSale | null | undefined): string {
  return isNonVatEurSale(sale) ? CONVERTED_CURRENCY_CODE : getSaleCurrencyCode(sale)
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
