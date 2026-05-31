export const CURRENCY_ORDER = ['EUR', 'USD', 'PLN'] as const

export type EntityFields = {
  Created?: string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: string
}

export type NamedEntity = EntityFields & {
  Code?: string
  FullName?: string
  Name?: string
}

export type CurrencyTraderExchangeRate = EntityFields & {
  CurrencyName?: string
  ExchangeRate?: number
  FromDate?: string
}

export type CurrencyTrader = EntityFields & {
  FirstName?: string
  LastName?: string
  MiddleName?: string
  PhoneNumber?: string
  FromDate?: string
  CurrencyTraderExchangeRates?: CurrencyTraderExchangeRate[]
}

export type CurrencyTraderExchangeRatesSearchParams = {
  from: string
  netId: string
  to: string
}

export type CurrencyTraderPayload = CurrencyTrader & {
  CurrencyTraderExchangeRates: CurrencyTraderExchangeRate[]
}
