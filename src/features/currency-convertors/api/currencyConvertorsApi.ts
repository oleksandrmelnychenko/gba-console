import { apiRequest } from '../../../shared/api/apiClient'
import type {
  CurrencyTrader,
  CurrencyTraderExchangeRate,
  CurrencyTraderExchangeRatesSearchParams,
  CurrencyTraderPayload,
} from '../types'

export async function getAllCurrencyTraders(): Promise<CurrencyTrader[]> {
  const result = await apiRequest<unknown>('/currencies/traders/all')

  return normalizeCurrencyTraders(result)
}

export async function getCurrencyTrader(netId: string): Promise<CurrencyTrader | null> {
  const result = await apiRequest<unknown>('/currencies/traders/get', {
    query: {
      netId,
    },
  })

  return normalizeCurrencyTrader(result)
}

export async function getCurrencyTraderExchangeRates(
  params: CurrencyTraderExchangeRatesSearchParams,
): Promise<CurrencyTraderExchangeRate[]> {
  const result = await apiRequest<unknown>('/currencies/traders/exchangerates/get/filtered', {
    query: {
      from: params.from,
      netId: params.netId,
      to: params.to,
    },
  })

  return normalizeExchangeRates(result)
}

export async function createCurrencyTrader(payload: CurrencyTraderPayload): Promise<CurrencyTrader | null> {
  const result = await apiRequest<unknown>('/currencies/traders/new', {
    method: 'POST',
    body: payload,
  })

  return normalizeCurrencyTrader(result)
}

export async function updateCurrencyTrader(payload: CurrencyTraderPayload): Promise<CurrencyTrader | null> {
  const result = await apiRequest<unknown>('/currencies/traders/update', {
    method: 'POST',
    body: payload,
  })

  return normalizeCurrencyTrader(result)
}

function normalizeCurrencyTraders(result: unknown): CurrencyTrader[] {
  if (Array.isArray(result)) {
    return result.map(ensureCurrencyTrader)
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>
  const items = Array.isArray(payload.Items)
    ? payload.Items
    : Array.isArray(payload.CurrencyTraders)
      ? payload.CurrencyTraders
      : Array.isArray(payload.Data)
        ? payload.Data
        : []

  return (items as CurrencyTrader[]).map(ensureCurrencyTrader)
}

function normalizeCurrencyTrader(result: unknown): CurrencyTrader | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return ensureCurrencyTrader(result as CurrencyTrader)
}

function normalizeExchangeRates(result: unknown): CurrencyTraderExchangeRate[] {
  if (Array.isArray(result)) {
    return result as CurrencyTraderExchangeRate[]
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  if (Array.isArray(payload.Items)) {
    return payload.Items as CurrencyTraderExchangeRate[]
  }

  if (Array.isArray(payload.CurrencyTraderExchangeRates)) {
    return payload.CurrencyTraderExchangeRates as CurrencyTraderExchangeRate[]
  }

  if (Array.isArray(payload.Collection)) {
    return payload.Collection as CurrencyTraderExchangeRate[]
  }

  return []
}

function ensureCurrencyTrader(currencyTrader: CurrencyTrader): CurrencyTrader {
  return {
    ...currencyTrader,
    CurrencyTraderExchangeRates: Array.isArray(currencyTrader.CurrencyTraderExchangeRates)
      ? currencyTrader.CurrencyTraderExchangeRates
      : [],
  }
}
