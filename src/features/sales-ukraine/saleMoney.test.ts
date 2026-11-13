import { expect, it } from 'vitest'
import { getSaleConvertedCurrencyCode, getSaleLocalCurrencyCode, isUahConvertedSale } from './saleMoney'
import type { SalesUkraineSale } from './types'

const sale = (code: string, withVat: boolean) => ({ ClientAgreement: { Agreement: { Currency: { Code: code }, WithVATAccounting: withVat } } }) as SalesUkraineSale

it('labels the converted column of a VAT sale in EUR as UAH because its values are the EUR to UAH conversion', () => {
  expect(getSaleLocalCurrencyCode(sale('EUR', true))).toBe('EUR')
  expect(isUahConvertedSale(sale('EUR', true))).toBe(true)
  expect(getSaleConvertedCurrencyCode(sale('EUR', true))).toBe('UAH')
  expect(getSaleConvertedCurrencyCode(sale('EUR', false))).toBe('UAH')
})

it('keeps the agreement currency for sales that are not in EUR', () => {
  expect(isUahConvertedSale(sale('UAH', true))).toBe(false)
  expect(getSaleConvertedCurrencyCode(sale('UAH', true))).toBe('UAH')
  expect(getSaleConvertedCurrencyCode(sale('USD', false))).toBe('USD')
})
