import { formatLocalDate, formatLocalDateTime } from '../../shared/date/dateTime'
import { exchangeRateEndpoints } from './api/exchangeRatesApi'
import type { ExchangeRate, ExchangeRateGroup, ExchangeRatesSnapshot } from './types'

const UKRAINE_LANGUAGE = 'uk'
const POLAND_LANGUAGE = 'pl'
const historyDateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export const HISTORY_PAGE_SIZE = 20

export function buildExchangeRateGroups(
  data: ExchangeRatesSnapshot,
  labels: {
    commercialCross: string
    commercialUah: string
    commercialPln: string
    governmentCross: string
    governmentUah: string
    governmentPln: string
  },
): ExchangeRateGroup[] {
  const groups: ExchangeRateGroup[] = [
    {
      id: 'commercial-cross',
      title: labels.commercialCross,
      rates: data.commercialCross,
      historyEndpoint: exchangeRateEndpoints.commercialCrossHistory,
      historyKey: 'CrossExchangeRateHistories',
      updateMode: 'single-cross',
    },
    {
      id: 'commercial-uah',
      title: labels.commercialUah,
      rates: data.commercial.filter((rate) => rate.Culture === UKRAINE_LANGUAGE),
      historyEndpoint: exchangeRateEndpoints.commercialHistory,
      historyKey: 'ExchangeRateHistories',
      updateMode: 'single-commercial',
    },
    {
      id: 'commercial-pln',
      title: labels.commercialPln,
      rates: data.commercial.filter((rate) => rate.Culture === POLAND_LANGUAGE),
      historyEndpoint: exchangeRateEndpoints.commercialHistory,
      historyKey: 'ExchangeRateHistories',
      updateMode: 'single-commercial',
    },
    {
      id: 'government-cross',
      title: labels.governmentCross,
      rates: data.governmentCross,
      historyEndpoint: exchangeRateEndpoints.governmentCrossHistory,
      historyKey: 'GovCrossExchangeRateHistories',
      updateMode: 'single-government-cross',
    },
    {
      id: 'government-uah',
      title: labels.governmentUah,
      rates: data.government.filter((rate) => rate.Culture === UKRAINE_LANGUAGE),
      historyEndpoint: exchangeRateEndpoints.governmentHistory,
      historyKey: 'GovExchangeRateHistories',
      updateMode: 'batch-government',
    },
    {
      id: 'government-pln',
      title: labels.governmentPln,
      rates: data.government.filter((rate) => rate.Culture === POLAND_LANGUAGE),
      historyEndpoint: exchangeRateEndpoints.governmentHistory,
      historyKey: 'GovExchangeRateHistories',
      updateMode: 'single-government',
    },
  ]

  return groups.filter((group) => group.rates.length > 0)
}

export function getRateKey(rate: ExchangeRate): string {
  return rate.NetUid || `${rate.Culture || 'rate'}-${rate.Code}`
}

export function formatRate(amount: number): string {
  return String(Math.round(Number(amount) * 10000) / 10000)
}

export function formatHistoryDate(value?: string | Date): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return historyDateFormatter.format(date)
}

export function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function getDefaultFormDate(groupId: string): Date {
  const now = new Date()

  if (groupId === 'government-uah' || groupId === 'government-pln') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 1, 0)
  }

  return now
}

export function toDateInputValue(date: Date): string {
  return formatLocalDate(date)
}

export function toDateTimeInputValue(date: Date): string {
  return formatLocalDateTime(date).slice(0, 16)
}

export function parseDateInputValue(value: string, fallback: Date, endOfDay = false): Date {
  if (!value) {
    return fallback
  }

  const date = new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}`)
  return Number.isNaN(date.getTime()) ? fallback : date
}

export function parseDateTimeInputValue(value: string, fallback: Date): Date {
  if (!value) {
    return fallback
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date
}
