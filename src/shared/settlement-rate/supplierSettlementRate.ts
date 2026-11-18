import { apiRequest } from '../api/apiClient'

/**
 * «Курс розрахунків» of a supplier agreement: which rate converts a supplier document into the EUR
 * agreement balance. Stored on the agreement as null (defaults), 1 (НБУ) or 2 (Комерційний).
 * Without a kind the server books a receipt at NBU on the invoice date and a payment at the
 * commercial rate on the payment date. Rates are «currency units per 1 EUR».
 */
export const SETTLEMENT_RATE_KIND = {
  Nbu: 1,
  Commercial: 2,
} as const

export type SettlementRateKind = (typeof SETTLEMENT_RATE_KIND)[keyof typeof SETTLEMENT_RATE_KIND]

export type SettlementRateDocument = 'receipt' | 'payment'

export type SettlementRateSource = 'eur' | 'nbu' | 'nbu_cross' | 'commercial' | 'commercial_cross' | 'manual' | 'none'

export type SupplierSettlementRateQuote = {
  AgreementKind?: SettlementRateKind | null
  CurrencyCode?: string | null
  DefaultKind?: SettlementRateKind | null
  Kind?: SettlementRateKind | null
  Rate?: number | null
  RateDate?: string | null
  Source?: SettlementRateSource | string | null
}

export type SupplierSettlementRateQuoteRequest = {
  /** ClientAgreement NetUid (not the Agreement's). */
  clientAgreementNetId: string
  /** The same date string the document will carry (InvDate of the upload, FromDate of the payment). */
  date: string
  document: SettlementRateDocument
  /** Quote this kind instead of the agreement default (the override preview). */
  kind?: SettlementRateKind | null
  /** Payment register currency; the server defaults to the agreement currency. */
  currencyNetId?: string | null
  signal?: AbortSignal
}

const QUOTE_ENDPOINT = '/agreements/settlement-rate/quote'

export async function getSupplierSettlementRateQuote({
  clientAgreementNetId,
  currencyNetId,
  date,
  document,
  kind,
  signal,
}: SupplierSettlementRateQuoteRequest): Promise<SupplierSettlementRateQuote | null> {
  const result = await apiRequest<unknown>(QUOTE_ENDPOINT, {
    query: {
      clientAgreementNetId,
      date,
      document,
      ...(kind ? { kind } : {}),
      ...(currencyNetId ? { currencyNetId } : {}),
    },
    ...(signal ? { signal } : {}),
  })

  return result && typeof result === 'object' ? (result as SupplierSettlementRateQuote) : null
}

export function isSettlementRateKind(value: unknown): value is SettlementRateKind {
  return value === SETTLEMENT_RATE_KIND.Nbu || value === SETTLEMENT_RATE_KIND.Commercial
}

export function settlementRateKindLabel(kind: unknown): string {
  if (kind === SETTLEMENT_RATE_KIND.Nbu) {
    return 'НБУ'
  }

  if (kind === SETTLEMENT_RATE_KIND.Commercial) {
    return 'Комерційний'
  }

  return ''
}

const rateFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 6,
  minimumFractionDigits: 0,
})

/** «50,222»: a rate as the screens show it; empty for a missing or non-positive rate. */
export function formatSettlementRate(rate: unknown): string {
  const value = typeof rate === 'number' ? rate : typeof rate === 'string' ? Number(rate.replace(',', '.')) : Number.NaN

  return Number.isFinite(value) && value > 0 ? rateFormatter.format(value) : ''
}

/**
 * «17.11.2026» of a server date. The server stores these dates in UTC but writes them in the user's time
 * zone (the X-Time-Zone header) without a designator, so a bare date-time is the user's local wall time
 * and its calendar day is shown as is; a value with a zone is shown in the local calendar day.
 */
export function formatSettlementRateDate(value: unknown): string {
  if (typeof value !== 'string' || !value) {
    return ''
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  // A bare «YYYY-MM-DDTHH:mm:ss» is parsed as local time by the Date constructor.
  const date = new Date(isDateOnly ? `${value}T00:00:00` : value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')

  return `${day}.${month}.${date.getFullYear()}`
}

/**
 * «НБУ 50,222 за 17.11.2026», «EUR — без перерахунку», or null when the quote has no rate.
 */
export function describeSettlementRateQuote(quote: SupplierSettlementRateQuote | null | undefined): string | null {
  if (!quote) {
    return null
  }

  if (quote.Source === 'eur') {
    return 'EUR — без перерахунку'
  }

  const rate = formatSettlementRate(quote.Rate)

  if (!rate) {
    return null
  }

  return joinParts([
    settlementRateKindLabel(quote.Kind),
    rate,
    formatSettlementRateDate(quote.RateDate) ? `за ${formatSettlementRateDate(quote.RateDate)}` : '',
  ])
}

/** «Немає курсу НБУ UAH/EUR на 17.11.2026» for a quote the rate table could not answer. */
export function describeMissingSettlementRate(quote: SupplierSettlementRateQuote | null | undefined): string {
  const kind = settlementRateKindLabel(quote?.Kind)
  const pair = quote?.CurrencyCode ? `${quote.CurrencyCode.toUpperCase()}/EUR` : ''
  const date = formatSettlementRateDate(quote?.RateDate)

  return joinParts(['Немає курсу', kind, pair, date ? `на ${date}` : ''])
}

/** A stored document rate: «Комерційний 51,2 за 18.11.2026 · змінено вручну», or null when none is stored. */
export function describeStoredSettlementRate({
  date,
  kind,
  overridden,
  rate,
}: {
  date?: unknown
  kind?: unknown
  overridden?: unknown
  rate?: unknown
}): string | null {
  const formattedRate = formatSettlementRate(rate)

  if (!formattedRate) {
    return null
  }

  const formattedDate = formatSettlementRateDate(date)
  const text = joinParts([settlementRateKindLabel(kind), formattedRate, formattedDate ? `за ${formattedDate}` : ''])

  return overridden === true ? `${text} · змінено вручну` : text
}

function joinParts(parts: string[]): string {
  return parts.filter(Boolean).join(' ')
}

/** What an override key holder chose; both empty means «book the agreement default». */
export type SettlementRateOverride = {
  kind: SettlementRateKind | null
  /** A typed rate (currency units per 1 EUR); 0 = none. */
  rate: number
}

export const EMPTY_SETTLEMENT_RATE_OVERRIDE: SettlementRateOverride = { kind: null, rate: 0 }

/** The override fields a request carries: nothing at all unless the user may override and chose something. */
export function settlementRateOverridePayload(
  canOverride: boolean,
  override: SettlementRateOverride,
): { kind: SettlementRateKind | null, rate: number | null } {
  if (!canOverride) {
    return { kind: null, rate: null }
  }

  return {
    kind: override.kind,
    rate: override.rate > 0 ? override.rate : null,
  }
}
