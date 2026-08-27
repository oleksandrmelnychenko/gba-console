import { apiRequest } from '../../../shared/api/apiClient'
import {
  executeAccountingMutation,
  type AccountingMutationOperationOptions,
} from '../../../shared/api/accountingMutationOperation'
import { PRINTER_API_BASE_URL } from '../../../shared/config/env'
import { toDateTimeQuery } from '../../../shared/date/dateTime'
import { normalizeExportDocument } from '../../../shared/documents/exportDocument'
import type {
  IncomePaymentOrder,
  PaymentMovement,
} from '../../income-cashflows/types'
import type {
  PrintTaxFreeResponse,
  Statham,
  TaxFreeDocument,
  TaxFreeDocumentsResponse,
  TaxFreeDocumentsSearchParams,
  TaxFreePrintDocument,
  TaxFreeItem,
} from '../types'

const CREATE_TAX_FREE_INCOME_ENDPOINT = '/payments/orders/income/tax-free-documents/new'

export async function getTaxFreeDocuments(params: TaxFreeDocumentsSearchParams): Promise<TaxFreeDocumentsResponse> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/taxfree/registry', {
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

export async function getTaxFreeDocument(netId: string): Promise<TaxFreeDocument | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/taxfree/details', {
    query: { netId },
  })
  const payload = unwrapPayload(result)

  return payload && typeof payload === 'object' && !Array.isArray(payload)
    ? normalizeTaxFreeDocument(payload as TaxFreeDocument)
    : null
}

export async function updateTaxFreeDocument(document: TaxFreeDocument): Promise<TaxFreeDocument> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/taxfree/edit', {
    body: document,
    method: 'POST',
  })

  return normalizeTaxFreeDocument(unwrapPayload(result) as TaxFreeDocument)
}

export async function changeTaxFreeDocumentStatus(document: TaxFreeDocument): Promise<TaxFreeDocument> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/taxfree/status/change', {
    body: document,
    method: 'POST',
  })

  return normalizeTaxFreeDocument(unwrapPayload(result) as TaxFreeDocument)
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

export async function getTaxFreePrintDocument(netId: string): Promise<TaxFreePrintDocument> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/taxfree/document/export', {
    query: {
      netId,
    },
  })

  return normalizeExportDocument(unwrapPayload(result))
}

export async function searchTaxFreeCarriers(value: string): Promise<Statham[]> {
  if (!value.trim()) {
    return []
  }

  const result = await apiRequest<unknown>('/supplies/ukraine/carriers/statham/tax-free-documents/search', {
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

  const result = await apiRequest<unknown>('/supplies/ukraine/carriers/statham/tax-free-documents/details', {
    query: {
      netId,
    },
  })

  const payload = unwrapPayload(result)

  return payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Statham) : null
}

export async function createTaxFreeCashflowArticle(operationName: string): Promise<PaymentMovement | null> {
  const result = await apiRequest<unknown>('/payments/movements/accounting/new', {
    body: { OperationName: operationName },
    method: 'POST',
  })
  const payload = unwrapPayload(result)

  return payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as PaymentMovement)
    : null
}

export async function createIncomePaymentFromTaxFree(
  taxFreeNetId: string,
  paymentIncome: IncomePaymentOrder,
  operation?: AccountingMutationOperationOptions,
): Promise<IncomePaymentOrder | null> {
  const result = await executeAccountingMutation({
    identity: paymentIncome,
    kind: 'income-payment:add-tax-free',
    operation,
    payload: {
      paymentIncome,
      taxFreeNetId,
    },
    request: (payload, context) => apiRequest<unknown>(CREATE_TAX_FREE_INCOME_ENDPOINT, {
      body: payload.paymentIncome,
      dedupe: false,
      headers: context.headers,
      method: 'POST',
      query: {
        taxFreeNetId: payload.taxFreeNetId,
      },
      ...(context.signal ? { signal: context.signal } : {}),
    }),
  })

  const payload = unwrapPayload(result)

  return payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as IncomePaymentOrder) : null
}

function normalizeTaxFreeDocumentsResponse(result: unknown): TaxFreeDocumentsResponse {
  const payload = unwrapPayload(result)
  const items = readArrayPayload(payload, ['Items', 'TaxFrees', 'Documents', 'Data', 'Collection', 'Values']).map((item) =>
    normalizeTaxFreeDocument(item as TaxFreeDocument),
  )
  const data = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {}
  const total = readNumber(data.Total, readNumber(data.TotalRowQty, readNumber(data.TotalRowsQty)))
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
  const payload = unwrapPayload(result)

  if (Array.isArray(payload)) {
    return payload
  }

  if (!payload || typeof payload !== 'object') {
    return []
  }

  const data = payload as Record<string, unknown>

  for (const key of keys) {
    if (Array.isArray(data[key])) {
      return data[key] as unknown[]
    }
  }

  return []
}

function unwrapPayload(result: unknown): unknown {
  if (!result || typeof result !== 'object' || !('Body' in result)) {
    return result
  }

  return (result as { Body?: unknown }).Body
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
