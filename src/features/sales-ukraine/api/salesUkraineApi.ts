import { ApiError, apiRequest, apiUrl, getApiLanguage } from '../../../shared/api/apiClient'
import { clearSession, notifyUnauthorized, readSession } from '../../../shared/auth/session'
import { getTimeZoneHeader } from '../../../shared/date/dateTime'
import { translate } from '../../../shared/i18n/translate'
import {
  SALES_IDEMPOTENCY_HEADER,
  SalesMutationPreflightValidationError,
  getSalesMutationOperationHeaders,
  normalizeSalesOperationNetUid,
  withSalesMutationOperationNetUid,
  type SalesMutationOperationOptions,
} from '../salesMutationOperation'
import {
  EMPTY_GUID,
  getSalesTtnFileValidationError,
  requirePersistedGuid,
  requirePositiveFiniteQuantity,
} from '../salesPayloadGuards'
import type {
  SaleClientDebtTotal,
  SaleConsignmentDocument,
  SaleConsignmentNoteSetting,
  SaleDocumentResult,
  SalesUkraineClientAgreement,
  SalesUkraineClientOption,
  SalesUkraineFilters,
  SalesUkraineOrderItem,
  SalesUkraineOrganizationOption,
  SalesUkraineProduct,
  SalesUkraineRetailPaymentStatus,
  SalesUkraineSale,
  SalesUkraineTransporter,
  SalesUkraineTransporterType,
} from '../types'

const CONSIGNMENT_QUERY = { forReSale: false }
const PACKING_ACCEPTANCE_REQUEST_ATTEMPTS = 3
const PAYMENT_DOCUMENT_POLL_INTERVAL_MS = 1_000
const PAYMENT_DOCUMENT_POLL_TIMEOUT_MS = 6 * 60 * 1_000

export async function getSalesUkraine(filters: SalesUkraineFilters, signal?: AbortSignal): Promise<SalesUkraineSale[]> {
  const result = await apiRequest<unknown>('/sales/all/filtered', {
    signal,
    query: {
      clientId: filters.clientId || undefined,
      fastEcommerce: false,
      forEcommerce: filters.forEcommerce,
      from: filters.from,
      fromShipments: false,
      includeDetails: false,
      limit: filters.limit,
      offset: filters.offset,
      organisationIds: filters.organisationIds.length ? filters.organisationIds : undefined,
      status: filters.status === 'all' ? 'All' : filters.status,
      to: filters.to,
      type: filters.type,
      value: filters.value.trim() || undefined,
    },
  })

  return normalizeArray(result) as SalesUkraineSale[]
}

export async function getSalesUkraineOrganizations(): Promise<SalesUkraineOrganizationOption[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return normalizeArray(result) as SalesUkraineOrganizationOption[]
}

export async function searchSalesUkraineClients(
  value: string,
  signal?: AbortSignal,
): Promise<SalesUkraineClientOption[]> {
  const searchValue = value.trim()

  if (!searchValue) {
    return []
  }

  const result = await apiRequest<unknown>('/clients/all/filtered', {
    query: {
      filterSql: 'RegionCode.Value/Client.FullName',
      limit: 50,
      offset: 0,
      value: searchValue,
    },
    signal,
  })

  return normalizeArray(result) as SalesUkraineClientOption[]
}

export async function unlockSale(
  netId: string,
  operation: SalesMutationOperationOptions,
): Promise<SalesUkraineSale | null> {
  const saleNetUid = requirePersistedGuid(
    netId,
    'Не вдалося визначити продаж для розблокування',
  )

  const result = await apiRequest<unknown>('/sales/unlock', {
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'PATCH',
    query: { netId: saleNetUid },
    signal: operation.signal,
  })

  return normalizeSale(result)
}

export async function acceptSaleForPacking(
  netId: string,
  operation: SalesMutationOperationOptions,
): Promise<SalesUkraineSale | null> {
  const saleNetUid = requirePersistedGuid(
    netId,
    'Не вдалося визначити продаж для відвантаження',
  )

  const requestOptions = {
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'PATCH',
    query: { netId: saleNetUid },
    signal: operation.signal,
  } as const

  // The server records this transition under the idempotency key before
  // replying. If a proxy timeout or transient 5xx loses that reply, replay the
  // exact request here instead of making the operator confirm it two or three
  // times manually.
  for (let attempt = 1; attempt <= PACKING_ACCEPTANCE_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      const result = await apiRequest<unknown>('/sales/accept-for-packing', requestOptions)

      return normalizeSale(result)
    } catch (error) {
      if (
        attempt === PACKING_ACCEPTANCE_REQUEST_ATTEMPTS ||
        operation.signal?.aborted ||
        !isTransientPackingAcceptanceFailure(error)
      ) {
        throw error
      }
    }
  }

  throw new Error('Packing acceptance retry policy did not execute')
}

function isTransientPackingAcceptanceFailure(error: unknown): boolean {
  return error instanceof ApiError && (
    error.status === 0 ||
    error.status === 408 ||
    error.status >= 500
  )
}

export async function getSaleById(netId: string, signal?: AbortSignal): Promise<SalesUkraineSale | null> {
  const result = await apiRequest<unknown>('/sales/get', {
    query: { netId },
    ...(signal ? { signal } : {}),
  })

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return null
  }

  const sale = (result as { Sale?: unknown }).Sale

  if (sale && typeof sale === 'object' && !Array.isArray(sale)) {
    return sale as SalesUkraineSale
  }

  return result as SalesUkraineSale
}

export async function getShiftedSaleById(netId: string): Promise<SalesUkraineSale | null> {
  const result = await apiRequest<unknown>('/sales/get/shifted', {
    query: { netId },
  })

  return normalizeSale(result)
}

export async function getCurrentSaleCart(
  clientAgreementNetId: string,
  signal?: AbortSignal,
): Promise<SalesUkraineSale | null> {
  const result = await apiRequest<unknown>('/sales/get/current', {
    query: { netId: clientAgreementNetId },
    ...(signal ? { signal } : {}),
  })

  return normalizeSale(result)
}

export type SaleSubmitResult = {
  message: string | null
  sale: SalesUkraineSale | null
}

export async function createSale(
  sale: SalesUkraineSale,
  operation: SalesMutationOperationOptions,
): Promise<SaleSubmitResult> {
  return postSaleWithMessage(
    '/sales/new',
    withSalesMutationOperationNetUid(sale, operation.operationId),
    operation,
  )
}

export async function updateOrderItem(
  orderItem: SalesUkraineOrderItem,
  operation: SalesMutationOperationOptions,
): Promise<void> {
  const netUid = requirePersistedGuid(
    orderItem?.NetUid,
    translate('Позиція товару не має збереженого ідентифікатора'),
  )
  const quantity = requirePositiveFiniteQuantity(
    orderItem?.Qty,
    translate('Кількість товару має бути більшою за нуль'),
  )

  await apiRequest<unknown>('/orders/items/update', {
    body: withSalesMutationOperationNetUid({ ...orderItem, NetUid: netUid, Qty: quantity }, operation.operationId),
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'POST',
    ...(operation?.signal ? { signal: operation.signal } : {}),
  })
}

export async function deleteOrderItem(
  orderItemNetId: string,
  operation: SalesMutationOperationOptions,
): Promise<void> {
  const persistedOrderItemNetId = requirePersistedGuid(
    orderItemNetId,
    translate('Позиція товару не має збереженого ідентифікатора'),
  )

  await apiRequest<unknown>('/orders/items/delete', {
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'DELETE',
    query: { orderItemNetId: persistedOrderItemNetId },
    ...(operation?.signal ? { signal: operation.signal } : {}),
  })
}

export async function searchSaleProducts(value: string): Promise<SalesUkraineProduct[]> {
  const result = await apiRequest<unknown>('/products/search/vendorcode', {
    query: { limit: 20, offset: 0, value: value.trim() },
  })

  return normalizeArray(result) as SalesUkraineProduct[]
}

export async function addOrderItem(
  clientAgreementNetId: string,
  saleNetId: string,
  orderItem: SalesUkraineOrderItem,
  operation: SalesMutationOperationOptions,
): Promise<SalesUkraineOrderItem | null> {
  const persistedClientAgreementNetId = requirePersistedGuid(
    clientAgreementNetId,
    translate('Договір клієнта не має збереженого ідентифікатора'),
  )
  const normalizedSaleNetId = saleNetId.trim().toLowerCase() || EMPTY_GUID
  const persistedSaleNetId = normalizedSaleNetId === EMPTY_GUID
    ? EMPTY_GUID
    : requirePersistedGuid(
        normalizedSaleNetId,
        translate('Продаж не має збереженого ідентифікатора'),
      )

  if ((orderItem.Product?.Id ?? 0) <= 0) {
    throw new SalesMutationPreflightValidationError(
      translate('Товар не має збереженого ідентифікатора'),
    )
  }

  requirePersistedGuid(
    orderItem.Product?.NetUid,
    translate('Товар не має збереженого ідентифікатора'),
  )
  const quantity = requirePositiveFiniteQuantity(
    orderItem.Qty,
    translate('Кількість товару має бути більшою за нуль'),
  )

  const result = await apiRequest<unknown>('/orders/items/new', {
    body: withSalesMutationOperationNetUid(
      { ...orderItem, Qty: quantity },
      operation.operationId,
    ),
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'POST',
    query: {
      clientAgreementNetId: persistedClientAgreementNetId,
      saleNetId: persistedSaleNetId,
    },
    ...(operation?.signal ? { signal: operation.signal } : {}),
  })

  return result && typeof result === 'object' && !Array.isArray(result) ? (result as SalesUkraineOrderItem) : null
}

export async function getSaleClientAgreements(clientNetId: string): Promise<SalesUkraineClientAgreement[]> {
  const result = await apiRequest<unknown>('/agreements/client/all', {
    query: { netId: clientNetId },
  })

  return normalizeArray(result) as SalesUkraineClientAgreement[]
}

export async function getSaleClientDebtTotal(clientNetId: string): Promise<SaleClientDebtTotal | null> {
  const result = await apiRequest<unknown>('/clients/get/debt/total', {
    query: { netId: clientNetId },
  })

  return result && typeof result === 'object' ? (result as SaleClientDebtTotal) : null
}

export async function getRetailPaymentStatusBySaleId(saleId: number): Promise<SalesUkraineRetailPaymentStatus | null> {
  const result = await apiRequest<unknown>('/retail/clients/paid/amount', {
    query: { saleId },
  })

  return result && typeof result === 'object' ? (result as SalesUkraineRetailPaymentStatus) : null
}

export type SwitchSalePayload = {
  ClientAgreementNetId: string
  SaleNetId: string
}

export async function switchSale(
  saleNetId: string,
  clientAgreementNetId: string,
  operation: SalesMutationOperationOptions,
): Promise<SalesUkraineSale | null> {
  const persistedSaleNetId = requirePersistedGuid(
    saleNetId,
    translate('Продаж не має збереженого ідентифікатора'),
  )
  const persistedClientAgreementNetId = requirePersistedGuid(
    clientAgreementNetId,
    translate('Договір клієнта не має збереженого ідентифікатора'),
  )
  const result = await apiRequest<unknown>('/sales/switch', {
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'PATCH',
    query: {
      clientAgreementNetId: persistedClientAgreementNetId,
      saleNetId: persistedSaleNetId,
    },
    ...(operation.signal ? { signal: operation.signal } : {}),
  })

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return null
  }

  const sale = (result as { Sale?: unknown }).Sale

  return sale && typeof sale === 'object' && !Array.isArray(sale) ? (sale as SalesUkraineSale) : (result as SalesUkraineSale)
}

export async function getMergedSales(saleNetId: string): Promise<SalesUkraineSale | null> {
  const result = await apiRequest<unknown>('/sales/get/merged', {
    query: { netId: saleNetId },
  })

  return normalizeSale(result)
}

export async function getCurrentUnmergedSale(clientAgreementNetId: string): Promise<SalesUkraineSale | null> {
  const result = await apiRequest<unknown>('/sales/get/current/unmerged', {
    query: { netId: clientAgreementNetId },
  })

  return normalizeSale(result)
}

export async function updateMergedSale(
  sale: SalesUkraineSale,
  operation: SalesMutationOperationOptions,
): Promise<void> {
  await apiRequest<unknown>('/sales/update/merged', {
    body: withSalesMutationOperationNetUid(sale, operation.operationId),
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'POST',
    ...(operation?.signal ? { signal: operation.signal } : {}),
  })
}

export async function updateSale(
  sale: SalesUkraineSale,
  operation: SalesMutationOperationOptions,
): Promise<void> {
  await apiRequest<unknown>('/sales/update', {
    body: withSalesMutationOperationNetUid(sale, operation.operationId),
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'POST',
    ...(operation.signal ? { signal: operation.signal } : {}),
  })
}

export async function updateSaleDiscount(
  sale: SalesUkraineSale,
  operation: SalesMutationOperationOptions,
): Promise<SalesUkraineSale | null> {
  const result = await apiRequest<unknown>('/sales/discount/update', {
    body: withSalesMutationOperationNetUid(sale, operation.operationId),
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'POST',
    ...(operation.signal ? { signal: operation.signal } : {}),
  })

  return normalizeSale(result)
}

export async function getSaleTransporterTypes(): Promise<SalesUkraineTransporterType[]> {
  const result = await apiRequest<unknown>('/transporters/types/all')

  return normalizeArray(result) as SalesUkraineTransporterType[]
}

export async function getSaleTransportersByType(netId: string): Promise<SalesUkraineTransporter[]> {
  const result = await apiRequest<unknown>('/transporters/all/type/hidden', {
    query: { netId },
  })

  return normalizeArray(result) as SalesUkraineTransporter[]
}

export async function updateSaleFromData(
  sale: SalesUkraineSale,
  file: File | null,
  operation: SalesMutationOperationOptions,
): Promise<SaleSubmitResult> {
  return postSaleWithMessage(
    '/sales/update/file',
    buildSaleFormData(sale, file, operation.operationId),
    operation,
  )
}

export async function convertVatSaleAndGetPaymentDocument(
  sale: SalesUkraineSale,
  file: File | null,
  operation: SalesMutationOperationOptions,
): Promise<SaleDocumentResult> {
  const requiredOperation = requirePaymentDocumentOperation(operation)
  const submission = await apiRequest<unknown>('/sales/update/get/payment/document', {
    body: buildSaleFormData(sale, file, requiredOperation.operationId),
    headers: getSalesMutationOperationHeaders(requiredOperation.operationId),
    method: 'POST',
    ...(requiredOperation.signal ? { signal: requiredOperation.signal } : {}),
  })

  const result = isPaymentDocumentProcessing(submission)
    ? await waitForPaymentDocument(
        requiredOperation.operationId,
        requiredOperation.signal,
      )
    : submission

  return extractDocumentResult(result)
}

async function waitForPaymentDocument(
  operationNetUid: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const deadline = Date.now() + PAYMENT_DOCUMENT_POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    await waitForPaymentDocumentPoll(signal)
    let status: unknown

    try {
      status = await apiRequest<unknown>(
        '/sales/update/get/payment/document',
        {
          ...(signal ? { signal } : {}),
          query: { operationNetUid },
        },
      )
    } catch (error) {
      if (isTransientPaymentDocumentPollError(error)) {
        continue
      }

      throw error
    }

    if (!isPaymentDocumentProcessing(status)) {
      return status
    }
  }

  throw new ApiError(
    translate(
      'Продаж збережено, документи ще формуються. Повторіть перевірку результату.',
    ),
    504,
    { OperationNetUid: operationNetUid, Status: 'processing' },
  )
}

function isTransientPaymentDocumentPollError(error: unknown): boolean {
  return error instanceof ApiError && (
    error.status === 0 ||
    error.status === 408 ||
    error.status === 429 ||
    error.status >= 500
  )
}

function isPaymentDocumentProcessing(result: unknown): boolean {
  if (!result || typeof result !== 'object') {
    return false
  }

  const record = result as Record<string, unknown>
  const status = record.Status ?? record.status
  return (
    record.IsCompleted === false ||
    record.isCompleted === false ||
    (typeof status === 'string' && status.toLowerCase() === 'processing')
  )
}

function waitForPaymentDocumentPoll(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(
      signal.reason instanceof Error
        ? signal.reason
        : new DOMException('The operation was aborted.', 'AbortError'),
    )
  }

  return new Promise((resolve, reject) => {
    const complete = () => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }
    const timer = setTimeout(
      complete,
      PAYMENT_DOCUMENT_POLL_INTERVAL_MS,
    )
    const abort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      reject(
        signal?.reason instanceof Error
          ? signal.reason
          : new DOMException('The operation was aborted.', 'AbortError'),
      )
    }

    signal?.addEventListener('abort', abort, { once: true })
  })
}

export function buildSaleFormData(sale: SalesUkraineSale, file: File | null, operationId: string): FormData {
  const fileValidationError = getSalesTtnFileValidationError(file)

  if (fileValidationError) {
    throw new SalesMutationPreflightValidationError(translate(fileValidationError))
  }

  const formData = new FormData()
  formData.append('sale', JSON.stringify(withSalesMutationOperationNetUid(sale, operationId)))

  if (file) {
    formData.append('file', file)
  }

  return formData
}

async function postSaleWithMessage(
  path: string,
  body: FormData | SalesUkraineSale,
  operation?: SalesMutationOperationOptions,
): Promise<SaleSubmitResult> {
  const isForm = body instanceof FormData
  const headers = new Headers(getTimeZoneHeader())
  const csrfToken = readSession()?.csrfToken

  if (csrfToken) {
    headers.set('X-CSRF-Token', csrfToken)
  }

  if (!isForm) {
    headers.set('Content-Type', 'application/json')
  }

  if (operation) {
    headers.set(SALES_IDEMPOTENCY_HEADER, normalizeSalesOperationNetUid(operation.operationId))
  }

  const response = await fetch(apiUrl(path, getApiLanguage()), {
    body: isForm ? body : JSON.stringify(body),
    credentials: 'include',
    headers,
    method: 'POST',
    ...(operation?.signal ? { signal: operation.signal } : {}),
  })

  if (response.status === 401) {
    const fallback = await apiRequest<unknown>(path, {
      body,
      ...(operation ? { headers: getSalesMutationOperationHeaders(operation.operationId) } : {}),
      method: 'POST',
      ...(operation?.signal ? { signal: operation.signal } : {}),
    })

    return { message: null, sale: toSaleOrNull(fallback) }
  }

  const payload = await readResponsePayload(response)

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearSession()
      notifyUnauthorized()
    }

    throw new ApiError(
      readEnvelopeMessage(payload) ?? translate('Не вдалося виконати запит'),
      response.status,
      payload,
      response.headers,
    )
  }

  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
  const saleBody = record && 'Body' in record ? record.Body : payload

  return { message: readEnvelopeMessage(payload), sale: toSaleOrNull(saleBody) }
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text()

  if (!text) {
    return null
  }

  return safeParse(text) ?? text
}

function readEnvelopeMessage(payload: unknown): string | null {
  if (payload && typeof payload === 'object') {
    const message = (payload as { Message?: unknown }).Message

    if (typeof message === 'string' && message) {
      return message
    }
  }

  return null
}

function toSaleOrNull(value: unknown): SalesUkraineSale | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as SalesUkraineSale) : null
}

export async function shiftOrderItemsCurrent(
  sale: SalesUkraineSale,
  operation: SalesMutationOperationOptions,
): Promise<SalesUkraineSale | null> {
  const result = await apiRequest<unknown>('/orders/items/shift/current', {
    body: withSalesMutationOperationNetUid(sale, operation.operationId),
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'POST',
    ...(operation.signal ? { signal: operation.signal } : {}),
  })

  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>
    const nested = record.Sale

    if (nested && typeof nested === 'object') {
      return nested as SalesUkraineSale
    }

    return result as SalesUkraineSale
  }

  return null
}

export async function getSaleConsignmentNoteSettings(): Promise<SaleConsignmentNoteSetting[]> {
  const result = await apiRequest<unknown>('/consignment/note/settings/all/get', {
    query: CONSIGNMENT_QUERY,
  })

  return normalizeArray(result) as SaleConsignmentNoteSetting[]
}

export async function addSaleConsignmentNoteSetting(
  setting: SaleConsignmentNoteSetting,
): Promise<SaleConsignmentNoteSetting[]> {
  const result = await apiRequest<unknown>('/consignment/note/settings/add', {
    body: setting,
    method: 'POST',
    query: CONSIGNMENT_QUERY,
  })

  return normalizeArray(result) as SaleConsignmentNoteSetting[]
}

export async function updateSaleConsignmentNoteSetting(
  setting: SaleConsignmentNoteSetting,
): Promise<SaleConsignmentNoteSetting[]> {
  const result = await apiRequest<unknown>('/consignment/note/settings/update', {
    body: setting,
    method: 'POST',
    query: CONSIGNMENT_QUERY,
  })

  return normalizeArray(result) as SaleConsignmentNoteSetting[]
}

export async function removeSaleConsignmentNoteSetting(netId: string): Promise<SaleConsignmentNoteSetting[]> {
  const result = await apiRequest<unknown>('/consignment/note/settings/remove', {
    body: {},
    method: 'POST',
    query: { ...CONSIGNMENT_QUERY, netId },
  })

  return normalizeArray(result) as SaleConsignmentNoteSetting[]
}

export async function printSaleConsignmentNoteDocument(
  saleNetId: string,
  setting: SaleConsignmentNoteSetting,
): Promise<SaleConsignmentDocument> {
  const result = await apiRequest<unknown>('/consignment/note/settings/print/document', {
    body: setting,
    method: 'POST',
    query: { ...CONSIGNMENT_QUERY, netId: saleNetId },
  })

  return (result && typeof result === 'object' ? result : {}) as SaleConsignmentDocument
}

async function fetchSaleDocument(
  path: string,
  query: Record<string, string>,
  operation?: SalesMutationOperationOptions,
): Promise<SaleDocumentResult> {
  const result = await apiRequest<unknown>(path, {
    query,
    ...(operation
      ? { headers: getSalesMutationOperationHeaders(operation.operationId) }
      : {}),
    ...(operation?.signal ? { signal: operation.signal } : {}),
  })

  return extractDocumentResult(result)
}

async function fetchSalePdfDocument(path: string, query: Record<string, string>): Promise<SaleDocumentResult> {
  const document = await fetchSaleDocument(path, query)

  return {
    ...document,
    excelUrl: null,
    pdfUrl: document.pdfUrl || document.excelUrl,
  }
}

export function getSaleInvoiceDocument(netId: string): Promise<SaleDocumentResult> {
  return fetchSaleDocument('/sales/get/last/document', { netId })
}

export function getSaleShipmentListDocument(netId: string): Promise<SaleDocumentResult> {
  return fetchSaleDocument('/sales/shipment/list/print/documents', { netId })
}

export async function getSalePaymentDocument(
  netId: string,
  operation: SalesMutationOperationOptions | undefined,
): Promise<SaleDocumentResult> {
  const requiredOperation = requirePaymentDocumentOperation(operation)

  return fetchSaleDocument('/sales/get/payment/document', { netId }, requiredOperation)
}

export function getSalePzDocument(netId: string): Promise<SaleDocumentResult> {
  return fetchSalePdfDocument('/sales/get/document/pz', { netId })
}

export function getSaleInvoiceHistoryDocument(netId: string, historyNetId: string): Promise<SaleDocumentResult> {
  return fetchSaleDocument('/sales/get/document/history', { historyNetId, netId })
}

export function getSaleActProtocolEditDocument(netId: string): Promise<SaleDocumentResult> {
  return fetchSaleDocument('/sales/get/shifted/document', { netId })
}

export function getSaleActForEditingHistoryDocument(netId: string, historyNetId: string): Promise<SaleDocumentResult> {
  return fetchSaleDocument('/sales/get/shifted/hisotry/document', { historyNetId, netId })
}

export function getSaleShipmentListHistoryDocument(netId: string, historyNetId: string): Promise<SaleDocumentResult> {
  return fetchSaleDocument('/sales/shipment/list/print/documents/history', { historyNetId, netId })
}

function requirePaymentDocumentOperation(
  operation: SalesMutationOperationOptions | undefined,
): SalesMutationOperationOptions {
  const operationId = requirePersistedGuid(
    operation?.operationId,
    translate('Операція формування платіжного документа не має коректного ідентифікатора'),
  )

  return {
    operationId,
    ...(operation?.signal ? { signal: operation.signal } : {}),
  }
}

function extractDocumentResult(result: unknown): SaleDocumentResult {
  if (typeof result === 'string') {
    return {
      excelUrl: toSecureUrl(result.trim() || null),
      pdfUrl: null,
      invoiceExcelUrl: null,
      invoicePdfUrl: null,
      isAcceptedToPacking: false,
    }
  }

  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>
    const excel = record.DocumentURL ?? record.DocumentUrl ?? record.XlsxDocument ?? record.Url ?? record.url
    const pdf = record.PdfDocumentURL ?? record.PdfDocumentUrl ?? record.PdfDocument
    const invoiceExcel = record.InvoiceDocumentURL ?? record.InvoiceDocumentUrl ?? record.InvoiceDocument ?? record.XlsxInvoiceDocument
    const invoicePdf = record.PdfInvoiceDocumentURL ?? record.PdfInvoiceDocumentUrl ?? record.PdfInvoiceDocument

    return {
      excelUrl: typeof excel === 'string' ? toSecureUrl(excel.trim() || null) : null,
      pdfUrl: typeof pdf === 'string' ? toSecureUrl(pdf.trim() || null) : null,
      invoiceExcelUrl: typeof invoiceExcel === 'string' ? toSecureUrl(invoiceExcel.trim() || null) : null,
      invoicePdfUrl: typeof invoicePdf === 'string' ? toSecureUrl(invoicePdf.trim() || null) : null,
      isAcceptedToPacking: record.IsAcceptedToPacking === true,
    }
  }

  return { excelUrl: null, pdfUrl: null, invoiceExcelUrl: null, invoicePdfUrl: null, isAcceptedToPacking: false }
}

function toSecureUrl(url: string | null): string | null {
  if (!url) {
    return null
  }

  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url)) {
    return url
  }

  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url
}

function normalizeArray(result: unknown): unknown[] {
  const parsed = typeof result === 'string' ? safeParse(result) : result

  if (Array.isArray(parsed)) {
    return parsed
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>

    for (const key of [
      'Items',
      'Sales',
      'Clients',
      'Organizations',
      'Organisations',
      'Transporters',
      'TransporterTypes',
      'ClientAgreements',
      'Agreements',
      'Data',
      'Collection',
    ]) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[]
      }
    }
  }

  return []
}

function normalizeSale(result: unknown): SalesUkraineSale | null {
  const parsed = typeof result === 'string' ? safeParse(result) : result

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }

  const record = parsed as Record<string, unknown>
  const sale = record.Sale

  if (sale && typeof sale === 'object' && !Array.isArray(sale)) {
    return sale as SalesUkraineSale
  }

  return record as SalesUkraineSale
}

function safeParse(value: string): unknown {
  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  try {
    return JSON.parse(normalized) as unknown
  } catch {
    return null
  }
}
