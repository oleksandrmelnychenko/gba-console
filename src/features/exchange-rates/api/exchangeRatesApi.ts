import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ExchangeRate,
  ExchangeRateHistoryRequest,
  ExchangeRateUpdateMode,
  ExchangeRatesSnapshot,
} from '../types'

const endpoints = {
  commercial: '/exchangerates/get/current',
  commercialCross: '/exchangerates/cross/all',
  government: '/exchangerates/gov/get/current',
  governmentCross: '/exchangerates/cross/gov/all',
  commercialHistory: '/exchangerates/history/specific',
  commercialCrossHistory: '/exchangerates/cross/history/specific',
  governmentHistory: '/exchangerates/gov/history/specific',
  governmentCrossHistory: '/exchangerates/cross/gov/history/specific',
  updateCommercial: '/exchangerates/update',
  updateCommercialCross: '/exchangerates/cross/update',
  updateGovernment: '/exchangerates/gov/update',
  updateGovernmentCross: '/exchangerates/cross/gov/update',
}

export const exchangeRateEndpoints = endpoints

export async function getExchangeRatesSnapshot(): Promise<ExchangeRatesSnapshot> {
  const [commercial, commercialCross, government, governmentCross] = await Promise.all([
    getRates(endpoints.commercial),
    getRates(endpoints.commercialCross),
    getRates(endpoints.government),
    getRates(endpoints.governmentCross),
  ])

  return {
    commercial,
    commercialCross,
    government,
    governmentCross,
  }
}

async function getRates(endpoint: string): Promise<ExchangeRate[]> {
  return apiRequest<ExchangeRate[]>(endpoint)
}

export async function getExchangeRateHistory({
  endpoint,
  from,
  historyKey,
  limit,
  netUid,
  offset,
  to,
}: ExchangeRateHistoryRequest): Promise<ExchangeRate[]> {
  const rates = await apiRequest<ExchangeRate[]>(endpoint, {
    query: {
      from,
      limit,
      netIds: [netUid],
      offset,
      to,
    },
  })

  return rates[0]?.[historyKey] || []
}

export async function updateExchangeRates(updateMode: ExchangeRateUpdateMode, rates: ExchangeRate[]): Promise<void> {
  const preparedRates = rates.map((rate) => ({
    ...rate,
    Amount: Number(rate.Amount),
  }))

  if (updateMode === 'batch-government') {
    await apiRequest<unknown>(endpoints.updateGovernment, {
      method: 'POST',
      body: preparedRates,
    })
    return
  }

  const endpoint = getSingleUpdateEndpoint(updateMode)

  await Promise.all(
    preparedRates.map((rate) =>
      apiRequest<unknown>(endpoint, {
        method: 'POST',
        body: rate,
      }),
    ),
  )
}

function getSingleUpdateEndpoint(updateMode: ExchangeRateUpdateMode): string {
  switch (updateMode) {
    case 'single-commercial':
      return endpoints.updateCommercial
    case 'single-cross':
      return endpoints.updateCommercialCross
    case 'single-government':
      return endpoints.updateGovernment
    case 'single-government-cross':
      return endpoints.updateGovernmentCross
    default:
      return endpoints.updateCommercial
  }
}
