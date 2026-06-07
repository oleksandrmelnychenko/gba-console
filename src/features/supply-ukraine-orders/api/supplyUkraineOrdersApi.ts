import { apiRequest } from '../../../shared/api/apiClient'
import { normalizeDisplayNumber } from '../../../shared/supplyUkraineOrderNumbers'
import type {
  Client,
  Currency,
  DirectSupplyOrder,
  DirectSupplyOrderCreatePayload,
  Organization,
  PackingList,
  PackingListDocumentParseConfiguration,
  ProductDeliveryExpense,
  SupplyServiceConsumableProduct,
  SupplyServiceOrganization,
  SupplyInvoice,
  SupplyOrderInvoiceTotals,
  SupplyOrderItem,
  SupplyOrderUkraineDocument,
  SupplyOrderUkraineItem,
  SupplyOrderDocumentParseConfiguration,
  SupplyOrderFromFileResponse,
  SupplyOrderPrintColumn,
  SupplyOrderPrintDocument,
  SupplyOrderUkraine,
  SupplyUkraineOrdersResponse,
  SupplyUkraineOrdersSearchParams,
} from '../types'

const TARGET_ORGANIZATION_CULTURE_PREFIX = 'uk'

export async function getSupplyUkraineOrders(
  params: SupplyUkraineOrdersSearchParams,
): Promise<SupplyUkraineOrdersResponse<SupplyOrderUkraine>> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/all/filtered', {
    query: buildSearchQuery(params),
  })

  return normalizeOrdersResponse<SupplyOrderUkraine>(result, ['Items', 'SupplyUkraineOrders', 'Orders', 'Data'])
}

export async function getDirectSupplyUkraineOrders(
  params: SupplyUkraineOrdersSearchParams,
): Promise<SupplyUkraineOrdersResponse<DirectSupplyOrder>> {
  const result = await apiRequest<unknown>('/supplies/orders/all/uk/filtered', {
    query: buildSearchQuery(params),
  })
  const response = normalizeOrdersResponse<DirectSupplyOrder>(result, ['Items', 'SupplyOrders', 'Orders', 'Data'])

  return {
    ...response,
    items: response.items.map(normalizeDirectSupplyOrderObject),
  }
}

export async function deleteSupplyUkraineOrder(netId: string): Promise<void> {
  await apiRequest<unknown>('/supplies/ukraine/order/delete', {
    method: 'DELETE',
    query: { netId },
  })
}

export async function deleteDirectSupplyUkraineOrder(netId: string): Promise<void> {
  await apiRequest<unknown>('/supplies/orders/delete', {
    method: 'DELETE',
    query: { netId },
  })
}

export async function getDirectSupplyOrderById(netId: string): Promise<DirectSupplyOrder | null> {
  const result = await apiRequest<unknown>('/supplies/orders/get', {
    query: { netId },
  })

  return normalizeDirectSupplyOrder(result)
}

export async function updateDirectSupplyOrder(order: DirectSupplyOrder): Promise<DirectSupplyOrder | null> {
  const result = await apiRequest<unknown>('/supplies/orders/update', {
    body: order,
    method: 'POST',
  })

  return normalizeDirectSupplyOrder(result)
}

export async function uploadSupplyOrderDocument(formData: FormData): Promise<DirectSupplyOrder | null> {
  const result = await apiRequest<unknown>('/supplies/documents/upload', {
    body: formData,
    method: 'POST',
  })

  return normalizeDirectSupplyOrder(result)
}

export async function createSupplyCreditNote(supplyOrderNetId: string, formData: FormData): Promise<DirectSupplyOrder | null> {
  const result = await apiRequest<unknown>('/supplies/orders/upload/creditnote', {
    body: formData,
    method: 'POST',
    query: { netId: supplyOrderNetId },
  })

  return normalizeDirectSupplyOrder(result)
}

export async function getSupplyOrderItems(netId: string): Promise<SupplyOrderItem[]> {
  const result = await apiRequest<unknown>('/supplies/orders/items/all/order', {
    query: { netId },
  })

  return readArrayPayload(result, ['Items', 'SupplyOrderItems', 'Data']) as SupplyOrderItem[]
}

export async function getSupplyOrderInvoiceTotals(netId: string): Promise<SupplyOrderInvoiceTotals> {
  const result = await apiRequest<unknown>('/supplies/orders/get/items/total', {
    query: { netId },
  })

  return result && typeof result === 'object' ? (result as SupplyOrderInvoiceTotals) : {}
}

export async function getSupplyInvoiceItems(netId: string): Promise<SupplyInvoice | null> {
  const result = await apiRequest<unknown>('/supplies/invoices/items/get', {
    query: { netId },
  })

  return normalizeSupplyInvoice(result)
}

export async function updateSupplyInvoiceItems(invoice: SupplyInvoice): Promise<SupplyInvoice | null> {
  const result = await apiRequest<unknown>('/supplies/invoices/items/update', {
    body: invoice,
    method: 'POST',
  })

  return normalizeSupplyInvoice(result)
}

export async function updatePackingLists(invoice: SupplyInvoice): Promise<SupplyInvoice | null> {
  const result = await apiRequest<unknown>('/supplies/packinglists/update', {
    body: invoice,
    method: 'POST',
  })

  return normalizeSupplyInvoice(result)
}

export async function uploadPackingListDocuments(packingList: PackingList, documents: File[]): Promise<PackingList | null> {
  const formData = new FormData()

  formData.append('entity', JSON.stringify(packingList))

  for (const document of documents) {
    formData.append('documents', document)
  }

  const result = await apiRequest<unknown>('/supplies/packinglists/upload/documents', {
    body: formData,
    method: 'POST',
  })

  return normalizePackingList(result)
}

export async function uploadSupplyInvoiceFile({
  file,
  invoice,
  parseConfiguration,
  supplyOrderNetId,
}: {
  file: File
  invoice: SupplyInvoice
  parseConfiguration: SupplyOrderDocumentParseConfiguration
  supplyOrderNetId: string
}): Promise<SupplyInvoice | null> {
  const formData = new FormData()

  formData.append('file', file)
  formData.append('parseConfiguration', JSON.stringify(parseConfiguration))
  formData.append('supplyInvoice', JSON.stringify(invoice))

  const result = await apiRequest<unknown>('/supplies/invoices/update/file', {
    body: formData,
    method: 'POST',
    query: { netId: supplyOrderNetId },
  })

  return normalizeSupplyInvoice(result)
}

export async function uploadPackingListFile({
  file,
  packingList,
  parseConfiguration,
  supplyInvoiceNetId,
}: {
  file: File
  packingList: PackingList
  parseConfiguration: PackingListDocumentParseConfiguration
  supplyInvoiceNetId: string
}): Promise<PackingList | null> {
  const formData = new FormData()

  formData.append('file', file)
  formData.append('parseConfiguration', JSON.stringify(parseConfiguration))
  formData.append('packingList', JSON.stringify(packingList))

  const result = await apiRequest<unknown>('/supplies/packinglists/new/file', {
    body: formData,
    method: 'POST',
    query: { netId: supplyInvoiceNetId },
  })

  return normalizePackingList(result)
}

export async function deleteSupplyInvoice(netId: string): Promise<void> {
  await apiRequest<unknown>('/supplies/invoices/delete', {
    method: 'DELETE',
    query: { netId },
  })
}

export async function deletePackingList(netId: string): Promise<void> {
  await apiRequest<unknown>('/supplies/packinglists/delete', {
    method: 'DELETE',
    query: { netId },
  })
}

export async function getSupplyOrderCurrencies(): Promise<Currency[]> {
  const result = await apiRequest<unknown>('/currencies/all')

  return readArrayPayload(result, ['Items', 'Currencies', 'Data']) as Currency[]
}

export async function getSupplyOrderOrganizations(): Promise<Organization[]> {
  const result = await apiRequest<unknown>('/organizations/all')
  const organizations = readArrayPayload(result, ['Items', 'Organizations', 'Organisations', 'Data']) as Organization[]

  return organizations.filter((organization) => isTargetOrganizationCulture(organization.Culture))
}

export async function getSupplyOrderSuppliers(): Promise<Client[]> {
  const result = await apiRequest<unknown>('/clients/all/manufacturers')
  const suppliers = readArrayPayload(result, ['Items', 'Clients', 'Data']) as Client[]

  return suppliers.map((supplier) => ({
    ...supplier,
    ClientAgreements: (supplier.ClientAgreements || []).filter((clientAgreement) => {
      const culture = clientAgreement.Agreement?.Organization?.Culture

      return !culture || isTargetOrganizationCulture(culture)
    }),
  }))
}

export async function getSupplyOrderServiceOrganizations(): Promise<SupplyServiceOrganization[]> {
  const result = await apiRequest<unknown>('/supplies/organizations/all')

  return readArrayPayload(result, ['Items', 'SupplyOrganizations', 'Organizations', 'Data']) as SupplyServiceOrganization[]
}

export async function getSupplyOrderServiceConsumableProducts(value = ''): Promise<SupplyServiceConsumableProduct[]> {
  const result = await apiRequest<unknown>('/consumables/categories/supply/services/get', {
    query: { value },
  })

  if (result && typeof result === 'object' && 'ConsumableProducts' in result) {
    const products = (result as { ConsumableProducts?: unknown }).ConsumableProducts

    return Array.isArray(products) ? (products as SupplyServiceConsumableProduct[]) : []
  }

  return readArrayPayload(result, ['ConsumableProducts', 'Items', 'Data']) as SupplyServiceConsumableProduct[]
}

export async function createSupplyOrderUkraineDeliveryExpense(
  expense: ProductDeliveryExpense,
  actDocuments: File[],
): Promise<void> {
  const formData = new FormData()

  formData.append('deliveryExpensesString', JSON.stringify(expense))

  for (const document of actDocuments) {
    formData.append('act', document)
  }

  await apiRequest<unknown>('/supplies/ukraine/order/new/delivery-expenses', {
    body: formData,
    method: 'POST',
  })
}

export async function updateSupplyOrderUkraineDeliveryExpense(expense: ProductDeliveryExpense): Promise<void> {
  await apiRequest<unknown>('/supplies/ukraine/order/update/delivery-expenses', {
    body: expense,
    method: 'POST',
  })
}

export async function getSupplyUkraineOrderById(netId: string): Promise<SupplyOrderUkraine | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/get', {
    query: { netId },
  })

  return normalizeSupplyUkraineOrder(result)
}

export async function addVatPercentToSupplyOrderUkraine(order: SupplyOrderUkraine): Promise<SupplyOrderUkraine | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/vat/percent/add', {
    body: order,
    method: 'POST',
  })

  return normalizeSupplyUkraineOrder(result)
}

export async function updateSupplyOrderUkraineItems(
  netId: string,
  items: SupplyOrderUkraineItem[],
): Promise<SupplyOrderUkraine | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/item/update', {
    body: items,
    method: 'POST',
    query: { netId },
  })

  return normalizeSupplyUkraineOrder(result)
}

export async function manageSupplyOrderUkraineDocuments({
  documents,
  order,
}: {
  documents: File[]
  order: SupplyOrderUkraine
}): Promise<SupplyOrderUkraine | null> {
  const formData = new FormData()

  formData.append('orderInString', JSON.stringify(order))

  for (const document of documents) {
    formData.append('documents', document)
  }

  const result = await apiRequest<unknown>('/supplies/ukraine/order/documents/manage', {
    body: formData,
    method: 'POST',
  })

  return normalizeSupplyUkraineOrder(result)
}

export async function printSupplyOrdersDocument(
  from: string,
  to: string,
  columns: SupplyOrderPrintColumn[],
): Promise<SupplyOrderPrintDocument> {
  const result = await apiRequest<unknown>('/supplies/orders/print/documents', {
    method: 'POST',
    query: { from, to },
    body: columns,
  })

  return normalizePrintDocument(result)
}

export async function uploadDirectSupplyOrderFromFile({
  file,
  parseConfiguration,
  supplyOrder,
}: {
  file: File
  parseConfiguration: SupplyOrderDocumentParseConfiguration
  supplyOrder: DirectSupplyOrderCreatePayload
}): Promise<SupplyOrderFromFileResponse> {
  const formData = new FormData()

  formData.append('file', file)
  formData.append('parseConfiguration', JSON.stringify(parseConfiguration))
  formData.append('supplyOrder', JSON.stringify(supplyOrder))

  const result = await apiRequest<unknown>('/supplies/orders/new/file', {
    body: formData,
    method: 'POST',
  })

  return normalizeSupplyOrderFromFileResponse(result)
}

function buildSearchQuery(params: SupplyUkraineOrdersSearchParams) {
  return {
    currencyId: params.currencyId ? Number(params.currencyId) : undefined,
    from: params.from,
    limit: params.limit,
    offset: params.offset,
    supplierName: params.supplierName?.trim() || '',
    to: params.to,
  }
}

function normalizeOrdersResponse<TOrder>(
  result: unknown,
  keys: string[],
): SupplyUkraineOrdersResponse<TOrder> {
  const items = readArrayPayload(result, keys) as TOrder[]
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}
  const firstItem = items[0] && typeof items[0] === 'object' ? (items[0] as Record<string, unknown>) : {}
  const totalQty =
    readNumber(payload.TotalRowsQty) ??
    readNumber(payload.TotalRowQty) ??
    readNumber(payload.Total) ??
    readNumber(firstItem.TotalRowsQty) ??
    readNumber(firstItem.TotalRowQty) ??
    items.length

  return { items, totalQty }
}

function normalizeSupplyUkraineOrder(result: unknown): SupplyOrderUkraine | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const order = result as SupplyOrderUkraine

  return {
    ...order,
    SupplyOrderUkraineDocuments: ensureUkraineOrderDocuments(order.SupplyOrderUkraineDocuments),
    SupplyOrderUkraineItems: Array.isArray(order.SupplyOrderUkraineItems) ? order.SupplyOrderUkraineItems : [],
  }
}

function ensureUkraineOrderDocuments(documents: SupplyOrderUkraineDocument[] | undefined): SupplyOrderUkraineDocument[] {
  return Array.isArray(documents) ? documents : []
}

function normalizeDirectSupplyOrder(result: unknown): DirectSupplyOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const order = result as DirectSupplyOrder

  return normalizeDirectSupplyOrderObject(order)
}

function normalizeDirectSupplyOrderObject(order: DirectSupplyOrder): DirectSupplyOrder {
  return {
    ...order,
    CreditNoteDocuments: Array.isArray(order.CreditNoteDocuments) ? order.CreditNoteDocuments : [],
    SupplyInvoices: Array.isArray(order.SupplyInvoices) ? order.SupplyInvoices.map(ensureSupplyInvoice) : [],
    SupplyOrderDeliveryDocuments: Array.isArray(order.SupplyOrderDeliveryDocuments) ? order.SupplyOrderDeliveryDocuments : [],
    SupplyOrderItems: Array.isArray(order.SupplyOrderItems) ? order.SupplyOrderItems : [],
    SupplyOrderNumber: normalizeNumberObject(order.SupplyOrderNumber),
  }
}

function normalizeNumberObject<T extends { Number?: string | null } | null | undefined>(value: T): T {
  if (!value) {
    return value
  }

  return {
    ...value,
    Number: normalizeDisplayNumber(value.Number),
  }
}

function normalizeSupplyInvoice(result: unknown): SupplyInvoice | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return ensureSupplyInvoice(result as SupplyInvoice)
}

function normalizePackingList(result: unknown): PackingList | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return ensurePackingList(result as PackingList)
}

function ensureSupplyInvoice(invoice: SupplyInvoice): SupplyInvoice {
  return {
    ...invoice,
    PackingLists: Array.isArray(invoice.PackingLists) ? invoice.PackingLists.map(ensurePackingList) : [],
    SupplyInvoiceDeliveryDocuments: Array.isArray(invoice.SupplyInvoiceDeliveryDocuments)
      ? invoice.SupplyInvoiceDeliveryDocuments
      : [],
    SupplyInvoiceOrderItems: Array.isArray(invoice.SupplyInvoiceOrderItems) ? invoice.SupplyInvoiceOrderItems : [],
  }
}

function ensurePackingList(packingList: PackingList): PackingList {
  return {
    ...packingList,
    PackingListPackageOrderItems: Array.isArray(packingList.PackingListPackageOrderItems)
      ? packingList.PackingListPackageOrderItems
      : [],
  }
}

function normalizeSupplyOrderFromFileResponse(result: unknown): SupplyOrderFromFileResponse {
  const payload = parseJsonPayload(result)

  if (!payload || typeof payload !== 'object') {
    return {}
  }

  const response = payload as SupplyOrderFromFileResponse

  return {
    ...response,
    MissingVendorCodes: Array.isArray(response.MissingVendorCodes) ? response.MissingVendorCodes : [],
    SupplyOrder: response.SupplyOrder || null,
  }
}

function normalizePrintDocument(result: unknown): SupplyOrderPrintDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL: typeof payload.PdfDocumentURL === 'string' ? payload.PdfDocumentURL : '',
  }
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

function parseJsonPayload(result: unknown): unknown {
  if (typeof result !== 'string') {
    return result
  }

  try {
    return JSON.parse(result) as unknown
  } catch {
    return result
  }
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return undefined
}

function isTargetOrganizationCulture(culture: string | undefined): boolean {
  return Boolean(culture?.toLowerCase().startsWith(TARGET_ORGANIZATION_CULTURE_PREFIX))
}
