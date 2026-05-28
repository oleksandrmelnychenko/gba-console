export type ExchangeRate = {
  Id?: number
  NetUid?: string
  Culture?: string
  Currency?: string
  Created?: string | Date
  Updated?: string | Date
  Amount: number
  Code: string
  ExchangeRateHistories?: ExchangeRate[]
  CrossExchangeRateHistories?: ExchangeRate[]
  GovExchangeRateHistories?: ExchangeRate[]
  GovCrossExchangeRateHistories?: ExchangeRate[]
}

export type ExchangeRatesSnapshot = {
  commercial: ExchangeRate[]
  commercialCross: ExchangeRate[]
  government: ExchangeRate[]
  governmentCross: ExchangeRate[]
}

export type ExchangeRateGroupId =
  | 'commercial-cross'
  | 'commercial-uah'
  | 'commercial-pln'
  | 'government-cross'
  | 'government-uah'
  | 'government-pln'

export type ExchangeRateHistoryKey =
  | 'ExchangeRateHistories'
  | 'CrossExchangeRateHistories'
  | 'GovExchangeRateHistories'
  | 'GovCrossExchangeRateHistories'

export type ExchangeRateUpdateMode = 'single-commercial' | 'single-cross' | 'batch-government' | 'single-government-cross'

export type ExchangeRateGroup = {
  id: ExchangeRateGroupId
  title: string
  rates: ExchangeRate[]
  historyEndpoint: string
  historyKey: ExchangeRateHistoryKey
  updateMode: ExchangeRateUpdateMode
}

export type ExchangeRateHistoryRequest = {
  endpoint: string
  historyKey: ExchangeRateHistoryKey
  netUid: string
  limit: number
  offset: number
  from: Date
  to: Date
}
