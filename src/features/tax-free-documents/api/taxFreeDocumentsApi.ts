import { apiRequest } from '../../../shared/api/apiClient'
import { PRINTER_API_BASE_URL } from '../../../shared/config/env'
import { toDateTimeQuery } from '../../../shared/date/dateTime'
import type {
  IncomePaymentOrder,
} from '../../income-cashflows/types'
import type {
  PrintTaxFreeResponse,
  Statham,
  TaxFreeDocument,
  TaxFreeDocumentsResponse,
  TaxFreeDocumentsSearchParams,
  TaxFreeItem,
} from '../types'

export type TaxFreeAdvancePaymentPayload = {
  Amount?: number
  ClientAgreement?: unknown
  Comment?: string
  FromDate?: string
  Organization?: unknown
  VatAmount?: number
  VatPercent?: number
}

export async function getTaxFreeDocuments(params: TaxFreeDocumentsSearchParams): Promise<TaxFreeDocumentsResponse> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/taxfree/all/filtered', {
    query: {
      from: toDateTimeQuery(params.from, 'start'),
      limit: params.limit,
      offset: params.offset,
      status: params.status,
      stathamNetId: params.stathamNetId || '',
      to: toDateTimeQuery(params.to, 'end'),
      value: params.value?.trim() || '',
    },
  })

  return normalizeTaxFreeDocumentsResponse(result)
}

export async function updateTaxFreeDocument(document: TaxFreeDocument): Promise<TaxFreeDocument> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/taxfree/update', {
    body: document,
    method: 'POST',
  })

  return normalizeTaxFreeDocument(result as TaxFreeDocument)
}

export async function printTaxFreeDocument(document: TaxFreeDocument): Promise<PrintTaxFreeResponse> {
  const response = await fetch(printerApiUrl('/printer/manager/print/taxfree'), {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify(document),
  })
  const result = await readPrinterPayload(response)

  if (!response.ok) {
    throw new Error(readMessage(result) || 'Локальний сервіс друку недоступний')
  }

  return {
    Message: readMessage(result),
  }
}

export async function searchTaxFreeCarriers(value: string): Promise<Statham[]> {
  if (!value.trim()) {
    return []
  }

  const result = await apiRequest<unknown>('/supplies/ukraine/carriers/statham/all/search', {
    query: {
      value: value.trim(),
    },
  })

  return readArrayPayload(result, ['Items', 'Stathams', 'Carriers', 'Data']) as Statham[]
}

export async function getTaxFreeCarrier(netId: string): Promise<Statham | null> {
  if (!netId) {
    return null
  }

  const result = await apiRequest<unknown>('/supplies/ukraine/carriers/statham/get', {
    query: {
      netId,
    },
  })

  return result && typeof result === 'object' ? (result as Statham) : null
}

export async function createIncomePaymentFromTaxFree(
  taxFreeNetId: string,
  paymentIncome: IncomePaymentOrder,
): Promise<IncomePaymentOrder | null> {
  const result = await apiRequest<unknown>('/payments/orders/income/new/taxfree', {
    method: 'POST',
    query: {
      taxFreeNetId,
    },
    body: paymentIncome,
  })

  return result && typeof result === 'object' ? (result as IncomePaymentOrder) : null
}

export async function createAdvancePaymentFromTaxFree(
  taxFreeNetId: string,
  advancePayment: TaxFreeAdvancePaymentPayload,
): Promise<TaxFreeAdvancePaymentPayload | null> {
  const result = await apiRequest<unknown>('/payments/advance/new', {
    method: 'POST',
    query: {
      taxFreeNetId,
    },
    body: advancePayment,
  })

  return result && typeof result === 'object' ? (result as TaxFreeAdvancePaymentPayload) : null
}

function normalizeTaxFreeDocumentsResponse(result: unknown): TaxFreeDocumentsResponse {
  const items = readArrayPayload(result, ['Items', 'TaxFrees', 'Documents', 'Data']).map((item) =>
    normalizeTaxFreeDocument(item as TaxFreeDocument),
  )
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}
  const total = readNumber(payload.Total, readNumber(payload.TotalRowQty, readNumber(payload.TotalRowsQty)))
    ?? readNumber(items[0]?.TotalRowQty, readNumber(items[0]?.TotalRowsQty))

  return {
    Items: items,
    Total: total,
  }
}

function normalizeTaxFreeDocument(document: TaxFreeDocument): TaxFreeDocument {
  return {
    ...document,
    TaxFreeItems: normalizeTaxFreeItems(document.TaxFreeItems),
  }
}

function normalizeTaxFreeItems(items?: TaxFreeItem[]): TaxFreeItem[] {
  return Array.isArray(items) ? items : []
}

function readArrayPayload(result: unknown, keys: string[]): unknown[] {
  if (Array.isArray(result)) {
    return result
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return payload[key] as unknown[]
    }
  }

  return []
}

function readNumber(value: unknown, fallback?: number): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return fallback
}

function printerApiUrl(path: string): string {
  const baseUrl = PRINTER_API_BASE_URL.match(/^https?:\/\//i)
    ? PRINTER_API_BASE_URL
    : new URL(PRINTER_API_BASE_URL, window.location.origin).toString()
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const normalizedPath = path.replace(/^\//, '')

  return new URL(normalizedPath, normalizedBaseUrl).toString()
}

async function readPrinterPayload(response: Response): Promise<unknown> {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function readMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined
  }

  const data = payload as Record<string, unknown>

  if (typeof data.Message === 'string') {
    return data.Message
  }

  if (data.Body && typeof data.Body === 'object') {
    return readMessage(data.Body)
  }

  return undefined
}
