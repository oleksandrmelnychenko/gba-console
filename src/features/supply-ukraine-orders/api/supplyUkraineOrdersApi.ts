import { apiRequest } from '../../../shared/api/apiClient'
import { readSession } from '../../../shared/auth/session'
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
  SupplyInformationDeliveryProtocolKey,
  SupplyOrderPaymentDeliveryProtocolKey,
  SupplyOrderInvoiceTotals,
  SupplyOrderItem,
  SupplyProForm,
  SupplyOrderUkraineDocument,
  SupplyOrderUkraineItem,
  SupplyOrderDocumentParseConfiguration,
  SupplyOrderFromFileResponse,
  SupplyOrderUkraineFromFileResponse,
  SupplyOrderPrintColumn,
  SupplyOrderPrintDocument,
  SupplyOrderUkraine,
  SupplyUkraineOrdersResponse,
  SupplyUkraineOrdersSearchParams,
  SupplyOrderUkraineSupplierCreatePayload,
  User,
  UkraineOrderFromSupplierParseConfiguration,
} from '../types'

const TARGET_ORGANIZATION_CULTURE_PREFIX = 'uk'
const SUPPLY_ORGANIZATION_LOOKUP_LIMIT = 20
const SUPPLIER_FILE_OPERATION_STORAGE_PREFIX =
  'gba_console:supply-ukraine-supplier-file:v1'
const SUPPLIER_FILE_OPERATION_VERSION = 1
const SUPPLIER_FILE_OWNER_HEADER =
  'X-Supply-Order-Ukraine-Supplier-File-Owner'
const inFlightSupplierFileUploads = new WeakMap<File, Map<string, Promise<SupplyOrderUkraineFromFileResponse>>>()
const pendingSupplierFilesByOperation = new Map<string, File>()

type SupplierFileSnapshot = {
  file: {
    digest: string
    lastModified: number
    name: string
    size: number
    type: string
  }
  orderUkraine: SupplyOrderUkraineSupplierCreatePayload
  parseConfiguration: UkraineOrderFromSupplierParseConfiguration
}

type PendingSupplierFileOperation = {
  fingerprint: string
  operationNetUid: string
  ownerNetUid: string
  snapshot: SupplierFileSnapshot
  version: number
}

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
  const result = await apiRequest<unknown>('/supplies/orders/ukraine/all/filtered', {
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
  await apiRequest<unknown>('/supplies/orders/ukraine/delete', {
    method: 'DELETE',
    query: { netId },
  })
}

export async function getDirectSupplyOrderForLogisticWay(netId: string): Promise<DirectSupplyOrder | null> {
  const result = await apiRequest<unknown>('/supplies/orders/direct-supply-order/logistic-way/details', {
    query: { netId },
  })

  return normalizeDirectSupplyOrder(result)
}

export async function getDirectSupplyOrderForProductIncome(netId: string): Promise<DirectSupplyOrder | null> {
  const result = await apiRequest<unknown>('/supplies/orders/product-income/details', {
    query: { netId },
  })

  return normalizeDirectSupplyOrder(result)
}

export async function getDirectSupplyOrderForSpecifications(netId: string): Promise<DirectSupplyOrder | null> {
  const result = await apiRequest<unknown>('/supplies/orders/specifications/details', {
    query: { netId },
  })

  return normalizeDirectSupplyOrder(result)
}

export async function getDirectSupplyOrderForInvoices(netId: string): Promise<DirectSupplyOrder | null> {
  const result = await apiRequest<unknown>('/supplies/orders/direct-supply-order/invoices/details', {
    query: { netId },
  })

  return normalizeDirectSupplyOrder(result)
}

async function updateDirectSupplyOrderLogisticWay(
  action: 'amount' | 'approve' | 'delivery-document-file' | 'delivery-document-status' | 'proform',
  order: DirectSupplyOrder,
): Promise<DirectSupplyOrder | null> {
  const result = await apiRequest<unknown>(`/supplies/orders/direct-supply-order/logistic-way/${action}`, {
    body: order,
    method: 'POST',
  })

  return normalizeDirectSupplyOrder(result)
}

export async function updateSupplyProForm(
  supplyOrderNetId: string,
  proForm: SupplyProForm,
): Promise<SupplyProForm | null> {
  const result = await apiRequest<unknown>('/supplies/proforms/update', {
    body: proForm,
    method: 'POST',
    query: { netId: supplyOrderNetId },
  })

  return normalizeSupplyProForm(result as SupplyProForm | null)
}

export const updateDirectSupplyOrderLogisticAmount = (order: DirectSupplyOrder) =>
  updateDirectSupplyOrderLogisticWay('amount', order)

export const approveDirectSupplyOrderLogistic = (order: DirectSupplyOrder) =>
  updateDirectSupplyOrderLogisticWay('approve', order)

export const updateDirectSupplyOrderDeliveryDocumentStatus = (order: DirectSupplyOrder) =>
  updateDirectSupplyOrderLogisticWay('delivery-document-status', order)

export const clearDirectSupplyOrderDeliveryDocumentFile = (order: DirectSupplyOrder) =>
  updateDirectSupplyOrderLogisticWay('delivery-document-file', order)

export const updateDirectSupplyOrderProForm = (order: DirectSupplyOrder) =>
  updateDirectSupplyOrderLogisticWay('proform', order)

export async function uploadSupplyOrderDocument(formData: FormData): Promise<DirectSupplyOrder | null> {
  const result = await apiRequest<unknown>('/supplies/documents/direct-supply-order/logistic-way/upload', {
    body: formData,
    method: 'POST',
  })

  return normalizeDirectSupplyOrder(result)
}

export async function uploadDirectSupplyOrderLogisticDocument(formData: FormData): Promise<DirectSupplyOrder | null> {
  const result = await apiRequest<unknown>('/supplies/documents/direct-supply-order/logistic-way/upload', {
    body: formData,
    method: 'POST',
  })

  return normalizeDirectSupplyOrder(result)
}

export async function uploadSupplyOrderProformDocuments({
  files,
  orderNetId,
  proForm,
}: {
  files: File[]
  orderNetId: string
  proForm: SupplyProForm
}): Promise<DirectSupplyOrder | null> {
  const formData = new FormData()

  files.forEach((file) => formData.append('proFormFiles', file))
  formData.append('proForm', JSON.stringify(proForm))

  const result = await apiRequest<unknown>('/supplies/proforms/direct-supply-order/logistic-way/upload/documents', {
    body: formData,
    method: 'POST',
    query: { netId: orderNetId },
  })

  return normalizeDirectSupplyOrder(result)
}

export async function uploadDirectSupplyOrderLogisticProformDocuments({
  files,
  orderNetId,
  proForm,
}: {
  files: File[]
  orderNetId: string
  proForm: SupplyProForm
}): Promise<DirectSupplyOrder | null> {
  const formData = new FormData()

  files.forEach((file) => formData.append('proFormFiles', file))
  formData.append('proForm', JSON.stringify(proForm))

  const result = await apiRequest<unknown>('/supplies/proforms/direct-supply-order/logistic-way/upload/documents', {
    body: formData,
    method: 'POST',
    query: { netId: orderNetId },
  })

  return normalizeDirectSupplyOrder(result)
}

export async function deleteSupplyProformDocument(netId: string): Promise<void> {
  await apiRequest<unknown>('/supplies/proforms/direct-supply-order/logistic-way/delete/document', {
    method: 'DELETE',
    query: { netId },
  })
}

export async function createSupplyCreditNote(supplyOrderNetId: string, formData: FormData): Promise<DirectSupplyOrder | null> {
  const result = await apiRequest<unknown>('/supplies/orders/ukraine/upload/creditnote', {
    body: formData,
    method: 'POST',
    query: { netId: supplyOrderNetId },
  })

  return normalizeDirectSupplyOrder(result)
}

export async function getSupplyOrderItems(netId: string): Promise<SupplyOrderItem[]> {
  const result = await apiRequest<unknown>('/supplies/orders/items/direct-supply-order/invoices', {
    query: { netId },
  })

  return readArrayPayload(result, ['Items', 'SupplyOrderItems', 'Data']) as SupplyOrderItem[]
}

export async function getSupplyOrderItemsForInvoices(netId: string): Promise<SupplyOrderItem[]> {
  const result = await apiRequest<unknown>('/supplies/orders/items/direct-supply-order/invoices', {
    query: { netId },
  })

  return readArrayPayload(result, ['Items', 'SupplyOrderItems', 'Data']) as SupplyOrderItem[]
}

export async function getSupplyOrderInvoiceTotals(netId: string): Promise<SupplyOrderInvoiceTotals> {
  const result = await apiRequest<unknown>('/supplies/orders/direct-supply-order/invoices/totals', {
    query: { netId },
  })

  return result && typeof result === 'object' ? (result as SupplyOrderInvoiceTotals) : {}
}

export async function getSupplyOrderInvoiceTotalsForInvoices(netId: string): Promise<SupplyOrderInvoiceTotals> {
  const result = await apiRequest<unknown>('/supplies/orders/direct-supply-order/invoices/totals', {
    query: { netId },
  })

  return result && typeof result === 'object' ? (result as SupplyOrderInvoiceTotals) : {}
}

export async function getSupplyInvoiceItems(netId: string): Promise<SupplyInvoice | null> {
  const result = await apiRequest<unknown>('/supplies/invoices/direct-supply-order/items', {
    query: { netId },
  })

  return normalizeSupplyInvoice(result)
}

export async function getSupplyInvoiceItemsForSpecifications(netId: string): Promise<SupplyInvoice | null> {
  const result = await apiRequest<unknown>('/supplies/invoices/direct-supply-order/specification/items', {
    query: { netId },
  })

  return normalizeSupplyInvoice(result)
}

export async function getSupplyInvoiceItemsForDirectOrder(netId: string): Promise<SupplyInvoice | null> {
  const result = await apiRequest<unknown>('/supplies/invoices/direct-supply-order/items', {
    query: { netId },
  })

  return normalizeSupplyInvoice(result)
}

export async function updateSupplyInvoiceItems(invoice: SupplyInvoice): Promise<SupplyInvoice | null> {
  const result = await apiRequest<unknown>('/supplies/invoices/direct-supply-order/items/update', {
    body: invoice,
    method: 'POST',
  })

  return normalizeSupplyInvoice(result)
}

export async function updateDirectSupplyOrderInvoiceItems(invoice: SupplyInvoice): Promise<SupplyInvoice | null> {
  const result = await apiRequest<unknown>('/supplies/invoices/direct-supply-order/items/update', {
    body: invoice,
    method: 'POST',
  })

  return normalizeSupplyInvoice(result)
}

export async function updateSupplyInvoice(supplyOrderNetId: string, invoice: SupplyInvoice): Promise<SupplyInvoice | null> {
  const result = await apiRequest<unknown>('/supplies/invoices/direct-supply-order/update', {
    body: invoice,
    method: 'POST',
    query: { netId: supplyOrderNetId },
  })

  return normalizeSupplyInvoice(result)
}

export async function createDirectSupplyOrderLogisticPaymentTask(
  supplyOrderNetId: string,
  invoice: SupplyInvoice,
): Promise<SupplyInvoice | null> {
  const result = await apiRequest<unknown>('/supplies/invoices/direct-supply-order/logistic-way/payment-tasks/create', {
    body: invoice,
    method: 'POST',
    query: { netId: supplyOrderNetId },
  })

  return normalizeSupplyInvoice(result)
}

export async function deleteDirectSupplyOrderLogisticPaymentTask(
  supplyOrderNetId: string,
  invoice: SupplyInvoice,
): Promise<SupplyInvoice | null> {
  const result = await apiRequest<unknown>('/supplies/invoices/direct-supply-order/logistic-way/payment-tasks/delete', {
    body: invoice,
    method: 'POST',
    query: { netId: supplyOrderNetId },
  })

  return normalizeSupplyInvoice(result)
}

export async function getDirectSupplyOrderLogisticPaymentTasks(netId: string): Promise<SupplyInvoice | null> {
  const result = await apiRequest<unknown>('/supplies/invoices/direct-supply-order/logistic-way/payment-tasks/details', {
    query: { netId },
  })

  return normalizeSupplyInvoice(result)
}

export async function updateDirectSupplyOrderInvoice(
  supplyOrderNetId: string,
  invoice: SupplyInvoice,
): Promise<SupplyInvoice | null> {
  const result = await apiRequest<unknown>('/supplies/invoices/direct-supply-order/update', {
    body: invoice,
    method: 'POST',
    query: { netId: supplyOrderNetId },
  })

  return normalizeSupplyInvoice(result)
}

export async function updatePackingLists(invoice: SupplyInvoice): Promise<SupplyInvoice | null> {
  const result = await apiRequest<unknown>('/supplies/packinglists/direct-supply-order/update', {
    body: invoice,
    method: 'POST',
  })

  return normalizeSupplyInvoice(result)
}

export async function updateDirectSupplyOrderPackingLists(invoice: SupplyInvoice): Promise<SupplyInvoice | null> {
  const result = await apiRequest<unknown>('/supplies/packinglists/direct-supply-order/update', {
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

  const result = await apiRequest<unknown>('/supplies/packinglists/ukraine/upload/documents', {
    body: formData,
    method: 'POST',
  })

  return normalizePackingList(result)
}

export async function addDeliveryDocumentsToDirectSupplyInvoice(
  invoice: SupplyInvoice,
  documents: File[],
): Promise<DirectSupplyOrder | null> {
  const formData = new FormData()

  formData.append('invoice', JSON.stringify(invoice))

  for (const document of documents) {
    formData.append('documents', document)
  }

  const result = await apiRequest<unknown>('/supplies/invoices/direct-supply-order/specification/documents/add', {
    body: formData,
    method: 'POST',
  })

  return normalizeDirectSupplyOrder(result)
}

export async function addDeliveryDocumentsToDirectSupplyInvoiceForSpecifications(
  invoice: SupplyInvoice,
  documents: File[],
): Promise<DirectSupplyOrder | null> {
  const formData = new FormData()

  formData.append('invoice', JSON.stringify(invoice))

  for (const document of documents) {
    formData.append('documents', document)
  }

  const result = await apiRequest<unknown>('/supplies/invoices/direct-supply-order/specification/documents/add', {
    body: formData,
    method: 'POST',
  })

  return normalizeDirectSupplyOrder(result)
}

export async function uploadSupplyInvoiceDocuments({
  files,
  invoice,
  supplyOrderNetId,
}: {
  files: File[]
  invoice: SupplyInvoice
  supplyOrderNetId: string
}): Promise<DirectSupplyOrder | null> {
  const formData = new FormData()

  formData.append('invoice', JSON.stringify(invoice))

  for (const file of files) {
    formData.append('invoiceFiles', file)
  }

  const result = await apiRequest<unknown>('/supplies/invoices/ukraine/upload/documents', {
    body: formData,
    method: 'POST',
    query: { netId: supplyOrderNetId },
  })

  return normalizeDirectSupplyOrder(result)
}

export async function uploadDirectSupplyOrderInvoiceDocuments({
  files,
  invoice,
  supplyOrderNetId,
}: {
  files: File[]
  invoice: SupplyInvoice
  supplyOrderNetId: string
}): Promise<DirectSupplyOrder | null> {
  const formData = new FormData()

  formData.append('invoice', JSON.stringify(invoice))

  for (const file of files) {
    formData.append('invoiceFiles', file)
  }

  const result = await apiRequest<unknown>('/supplies/invoices/direct-supply-order/documents/upload', {
    body: formData,
    method: 'POST',
    query: { netId: supplyOrderNetId },
  })

  return normalizeDirectSupplyOrder(result)
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

  const result = await apiRequest<unknown>('/supplies/invoices/ukraine/update/file', {
    body: formData,
    method: 'POST',
    query: { netId: supplyOrderNetId },
  })

  return normalizeUploadedSupplyInvoice(result)
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

  const result = await apiRequest<unknown>('/supplies/packinglists/ukraine/new/file', {
    body: formData,
    method: 'POST',
    query: { netId: supplyInvoiceNetId },
  })

  return normalizeUploadedPackingList(result)
}

export async function deleteSupplyInvoice(netId: string): Promise<void> {
  await apiRequest<unknown>('/supplies/invoices/ukraine/delete', {
    method: 'DELETE',
    query: { netId },
  })
}

export async function deleteSupplyInvoiceDocument(netId: string): Promise<void> {
  await apiRequest<unknown>('/supplies/invoices/ukraine/delete/document', {
    method: 'DELETE',
    query: { netId },
  })
}

export async function deleteDirectSupplyOrderLogisticProformDocument(netId: string): Promise<void> {
  await apiRequest<unknown>('/supplies/proforms/direct-supply-order/logistic-way/delete/document', {
    method: 'DELETE',
    query: { netId },
  })
}

export async function deleteDirectSupplyOrderInvoiceDocument(netId: string): Promise<void> {
  await apiRequest<unknown>('/supplies/invoices/direct-supply-order/documents/delete', {
    method: 'DELETE',
    query: { netId },
  })
}

export async function deletePackingList(netId: string): Promise<void> {
  await apiRequest<unknown>('/supplies/packinglists/ukraine/delete', {
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
  return getSupplyOrderSuppliersAt('/clients/sad/supply-order/manufacturers')
}

export async function getSupplyOrderCreateSuppliers(
  mode: 'direct' | 'toUkraine',
): Promise<Client[]> {
  return getSupplyOrderSuppliersAt(
    mode === 'direct'
      ? '/clients/orders-ukraine/direct/manufacturers'
      : '/clients/orders-ukraine/to-ukraine/manufacturers',
  )
}

export async function getBudgetCartSuppliers(): Promise<Client[]> {
  return getSupplyOrderSuppliersAt('/clients/budget-cart/manufacturers')
}

export async function getPurchaseCockpitSuppliers(): Promise<Client[]> {
  return getSupplyOrderSuppliersAt('/clients/purchase-cockpit/manufacturers')
}

export async function getSupplyDashboardSuppliers(): Promise<Client[]> {
  return getSupplyOrderSuppliersAt('/clients/supply-dashboard/manufacturers')
}

async function getSupplyOrderSuppliersAt(path: string): Promise<Client[]> {
  const result = await apiRequest<unknown>(path)
  const suppliers = readArrayPayload(result, ['Items', 'Clients', 'Data']) as Client[]

  const normalizedSuppliers = suppliers.map((supplier) => ({
    ...supplier,
    ClientAgreements: (supplier.ClientAgreements || []).filter((clientAgreement) => {
      const culture = clientAgreement.Agreement?.Organization?.Culture

      return !culture || isTargetOrganizationCulture(culture)
    }),
  }))

  return dedupeSupplyOrderSuppliers(normalizedSuppliers)
}

export async function searchSupplyOrderServiceOrganizations(value: string): Promise<SupplyServiceOrganization[]> {
  return searchSupplyOrderServiceOrganizationsAt('/supplies/organizations/orders-ukraine/delivery-expenses/search', value)
}

export async function searchSupplyOrderServiceOrganizationsForSpecifications(
  value: string,
): Promise<SupplyServiceOrganization[]> {
  return searchSupplyOrderServiceOrganizationsAt(
    '/supplies/organizations/direct-supply-order/specification/search',
    value,
  )
}

async function searchSupplyOrderServiceOrganizationsAt(
  path: string,
  value: string,
): Promise<SupplyServiceOrganization[]> {
  const searchValue = value.trim()

  if (!searchValue) {
    return []
  }

  const result = await apiRequest<unknown>(path, {
    query: {
      limit: SUPPLY_ORGANIZATION_LOOKUP_LIMIT,
      offset: 0,
      value: searchValue,
    },
  })

  return readArrayPayload(result, ['Items', 'SupplyOrganizations', 'Organizations', 'Data']) as SupplyServiceOrganization[]
}

export async function getSupplyOrderServiceConsumableProducts(value = ''): Promise<SupplyServiceConsumableProduct[]> {
  const result = await apiRequest<unknown>('/consumables/categories/orders-ukraine/delivery-expenses/products', {
    query: { value },
  })

  if (result && typeof result === 'object' && 'ConsumableProducts' in result) {
    const products = (result as { ConsumableProducts?: unknown }).ConsumableProducts

    return Array.isArray(products) ? (products as SupplyServiceConsumableProduct[]) : []
  }

  return readArrayPayload(result, ['ConsumableProducts', 'Items', 'Data']) as SupplyServiceConsumableProduct[]
}

function dedupeSupplyOrderSuppliers(suppliers: Client[]): Client[] {
  const suppliersByVisibleKey = new Map<string, Client>()

  suppliers.forEach((supplier) => {
    const visibleKey = getSupplyOrderSupplierVisibleKey(supplier)
    const fallbackKey = supplier.NetUid || (supplier.Id ? String(supplier.Id) : '')
    const key = visibleKey || (fallbackKey ? `entity:${fallbackKey}` : '')

    if (!key) {
      return
    }

    const current = suppliersByVisibleKey.get(key)

    if (!current || getSupplyOrderSupplierRank(supplier) > getSupplyOrderSupplierRank(current)) {
      suppliersByVisibleKey.set(key, supplier)
    }
  })

  return dedupeSupplyOrderSuppliersByLabel(Array.from(suppliersByVisibleKey.values()))
}

function getSupplyOrderSupplierVisibleKey(supplier: Client): string {
  const legalCode = normalizeSupplierKeyPart(supplier.USREOU)

  if (legalCode) {
    return `code:${legalCode}`
  }

  const label = normalizeSupplierKeyPart(supplier.FullName || supplier.Name || supplier.Code)

  return label ? `label:${label}` : ''
}

function getSupplyOrderSupplierRank(supplier: Client): number {
  const agreementCount = supplier.ClientAgreements?.length || 0
  const hasLegalCode = normalizeSupplierKeyPart(supplier.USREOU) ? 1 : 0
  const hasStableKey = supplier.NetUid || supplier.Id ? 1 : 0

  return agreementCount * 100 + hasLegalCode * 10 + hasStableKey
}

function normalizeSupplierKeyPart(value?: string): string {
  return (value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('uk-UA')
}

function dedupeSupplyOrderSuppliersByLabel(suppliers: Client[]): Client[] {
  const suppliersByLabel = new Map<string, Client>()

  suppliers.forEach((supplier) => {
    const label = normalizeSupplierKeyPart(supplier.FullName || supplier.Name || supplier.Code)
    const key = label || `entity:${supplier.NetUid || supplier.Id || ''}`

    if (!key) {
      return
    }

    const current = suppliersByLabel.get(key)

    if (!current || getSupplyOrderSupplierRank(supplier) > getSupplyOrderSupplierRank(current)) {
      suppliersByLabel.set(key, supplier)
    }
  })

  return Array.from(suppliersByLabel.values())
}

export async function getSupplyInformationDeliveryProtocolKeys(): Promise<SupplyInformationDeliveryProtocolKey[]> {
  const result = await apiRequest<unknown>('/supplies/orders/informations/all/keys')

  return readArrayPayload(result, ['Items', 'Keys', 'Data']) as SupplyInformationDeliveryProtocolKey[]
}

export async function getDirectSupplyOrderInvoicePaymentProtocolKeys(): Promise<SupplyOrderPaymentDeliveryProtocolKey[]> {
  const result = await apiRequest<unknown>('/supplies/orders/direct-supply-order/invoices/payment-protocol-keys')

  return readArrayPayload(result, ['Items', 'Keys', 'Data']) as SupplyOrderPaymentDeliveryProtocolKey[]
}

export async function getDirectSupplyOrderLogisticPaymentTaskKeys(): Promise<SupplyOrderPaymentDeliveryProtocolKey[]> {
  const result = await apiRequest<unknown>('/supplies/orders/direct-supply-order/logistic-way/payment-task-keys')

  return readArrayPayload(result, ['Items', 'Keys', 'Data']) as SupplyOrderPaymentDeliveryProtocolKey[]
}

export async function getDirectSupplyOrderInvoiceInformationProtocolKeys(): Promise<SupplyInformationDeliveryProtocolKey[]> {
  const result = await apiRequest<unknown>('/supplies/orders/direct-supply-order/invoices/information-protocol-keys')

  return readArrayPayload(result, ['Items', 'Keys', 'Data']) as SupplyInformationDeliveryProtocolKey[]
}

export async function getDirectSupplyOrderInvoiceResponsibleUsers(): Promise<User[]> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/orders-ukraine/invoices/responsible-users')

  return readArrayPayload(result, ['Items', 'Users', 'Profiles', 'Data']) as User[]
}

export async function getDirectSupplyOrderLogisticPaymentTaskUsers(): Promise<User[]> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/orders-ukraine/logistic-way/payment-task-users')

  return readArrayPayload(result, ['Items', 'Users', 'Profiles', 'Data']) as User[]
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

export async function getSupplyUkraineOrderForOverview(netId: string): Promise<SupplyOrderUkraine | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/overview/details', {
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
  const result = await apiRequest<unknown>('/supplies/orders/ukraine/print/documents', {
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

  const result = await apiRequest<unknown>('/supplies/orders/ukraine/new/file', {
    body: formData,
    method: 'POST',
  })

  return normalizeSupplyOrderFromFileResponse(result)
}

export function uploadSupplyOrderUkraineFromSupplierFile({
  file,
  parseConfiguration,
  orderUkraine,
}: {
  file: File
  parseConfiguration: UkraineOrderFromSupplierParseConfiguration
  orderUkraine: SupplyOrderUkraineSupplierCreatePayload
}): Promise<SupplyOrderUkraineFromFileResponse> {
  const ownerNetUid = getSupplierFileOwnerNetUid()
  const orderSnapshot = snapshotSupplierFileOrder(orderUkraine)
  const configurationSnapshot = snapshotJson(parseConfiguration)
  const invocationKey = stableJson({
    configurationSnapshot,
    orderSnapshot,
    ownerNetUid,
  })
  let fileRequests = inFlightSupplierFileUploads.get(file)

  if (!fileRequests) {
    fileRequests = new Map()
    inFlightSupplierFileUploads.set(file, fileRequests)
  }

  const inFlight = fileRequests.get(invocationKey)

  if (inFlight) {
    return inFlight
  }

  const request = uploadSupplyOrderUkraineFromSupplierFileCore({
    configurationSnapshot,
    file,
    orderSnapshot,
    ownerNetUid,
  }).finally(() => {
    fileRequests?.delete(invocationKey)
  })
  fileRequests.set(invocationKey, request)

  return request
}

async function uploadSupplyOrderUkraineFromSupplierFileCore({
  configurationSnapshot,
  file,
  orderSnapshot,
  ownerNetUid,
}: {
  configurationSnapshot: UkraineOrderFromSupplierParseConfiguration
  file: File
  orderSnapshot: SupplyOrderUkraineSupplierCreatePayload
  ownerNetUid: string
}): Promise<SupplyOrderUkraineFromFileResponse> {
  const fileDigest = await sha256Bytes(await file.arrayBuffer())
  const snapshot: SupplierFileSnapshot = {
    file: {
      digest: fileDigest,
      lastModified: file.lastModified,
      name: file.name,
      size: file.size,
      type: file.type,
    },
    orderUkraine: orderSnapshot,
    parseConfiguration: configurationSnapshot,
  }
  const fingerprint = await sha256Text(stableJson({
    kind: 'supply-order-ukraine:supplier-file:v1',
    ownerNetUid,
    snapshot,
  }))
  const pending = getOrCreateSupplierFileOperation(
    ownerNetUid,
    fingerprint,
    snapshot,
    file,
  )
  if (getSupplierFileOwnerNetUid() !== pending.ownerNetUid) {
    clearSupplierFileOperation(pending)
    throw new Error(
      'Authenticated supplier-file order owner changed before the request was sent.',
    )
  }
  const formData = new FormData()

  formData.append('file', file)
  formData.append('parseConfiguration', JSON.stringify(pending.snapshot.parseConfiguration))
  formData.append('orderUkraine', JSON.stringify(pending.snapshot.orderUkraine))

  try {
    const result = await apiRequest<unknown>('/supplies/ukraine/order/new/supplier/file', {
      body: formData,
      headers: {
        'Idempotency-Key': pending.operationNetUid,
        [SUPPLIER_FILE_OWNER_HEADER]: pending.ownerNetUid,
      },
      method: 'POST',
      query: {
        operationNetUid: pending.operationNetUid,
      },
    })

    clearSupplierFileOperation(pending)
    return normalizeSupplyOrderUkraineFromFileResponse(result)
  } catch (error) {
    if (!isUnknownSupplierFileOutcome(error)) {
      clearSupplierFileOperation(pending)
    }

    throw error
  }
}

function getOrCreateSupplierFileOperation(
  ownerNetUid: string,
  fingerprint: string,
  snapshot: SupplierFileSnapshot,
  file: File,
): PendingSupplierFileOperation {
  const storage = requireSupplierFileStorage()
  const storageKey = supplierFileStorageKey(ownerNetUid)
  const persisted = readSupplierFileOperation(storage, storageKey)

  if (persisted) {
    if (
      persisted.ownerNetUid !== ownerNetUid
      || persisted.fingerprint !== fingerprint
      || stableJson(persisted.snapshot) !== stableJson(snapshot)
    ) {
      throw new Error(
        'A supplier-file order with an unknown outcome is pending. Retry its immutable payload before submitting a different order.',
      )
    }

    const selectedFile = pendingSupplierFilesByOperation.get(persisted.operationNetUid)

    if (selectedFile && selectedFile !== file) {
      throw new Error(
        'Retry the supplier-file order with the same selected File object.',
      )
    }

    pendingSupplierFilesByOperation.set(persisted.operationNetUid, file)
    return persisted
  }

  const operationNetUid = createSupplierFileOperationNetUid()
  const pending: PendingSupplierFileOperation = {
    fingerprint,
    operationNetUid,
    ownerNetUid,
    snapshot,
    version: SUPPLIER_FILE_OPERATION_VERSION,
  }

  try {
    storage.setItem(storageKey, JSON.stringify(pending))
    if (storage.getItem(storageKey) !== JSON.stringify(pending)) {
      throw new Error('Supplier-file retry state verification failed.')
    }
  } catch {
    throw new Error(
      'Supplier-file retry state could not be persisted. The request was not sent.',
    )
  }

  pendingSupplierFilesByOperation.set(operationNetUid, file)
  return pending
}

function readSupplierFileOperation(
  storage: Storage,
  storageKey: string,
): PendingSupplierFileOperation | null {
  let serialized: string | null

  try {
    serialized = storage.getItem(storageKey)
  } catch {
    throw new Error(
      'Supplier-file retry state could not be read. The request was not sent.',
    )
  }

  if (!serialized) {
    return null
  }

  try {
    const candidate = JSON.parse(serialized) as Partial<PendingSupplierFileOperation>

    if (
      candidate.version !== SUPPLIER_FILE_OPERATION_VERSION
      || !isNonEmptyGuid(candidate.operationNetUid)
      || typeof candidate.ownerNetUid !== 'string'
      || !candidate.ownerNetUid
      || typeof candidate.fingerprint !== 'string'
      || !/^[0-9a-f]{64}$/i.test(candidate.fingerprint)
      || !candidate.snapshot
      || typeof candidate.snapshot !== 'object'
      || !candidate.snapshot.file
      || !/^[0-9a-f]{64}$/i.test(candidate.snapshot.file.digest)
    ) {
      throw new Error('invalid supplier-file retry state')
    }

    return candidate as PendingSupplierFileOperation
  } catch {
    throw new Error(
      'Persisted supplier-file retry state is invalid. The request was not sent.',
    )
  }
}

function clearSupplierFileOperation(pending: PendingSupplierFileOperation) {
  pendingSupplierFilesByOperation.delete(pending.operationNetUid)

  try {
    const storage = requireSupplierFileStorage()
    const storageKey = supplierFileStorageKey(pending.ownerNetUid)
    const current = readSupplierFileOperation(storage, storageKey)

    if (current?.operationNetUid === pending.operationNetUid) {
      storage.removeItem(storageKey)
    }
  } catch {
    // A definitive server response is authoritative. Stale recovery data must
    // not turn a completed request into an apparent mutation failure.
  }
}

function snapshotSupplierFileOrder(
  order: SupplyOrderUkraineSupplierCreatePayload,
): SupplyOrderUkraineSupplierCreatePayload {
  return snapshotJson({
    ClientAgreement: supplierFileIdentity(order.ClientAgreement),
    Comment: order.Comment,
    FromDate: order.FromDate,
    InvDate: order.InvDate,
    InvNumber: order.InvNumber,
    IsDirectFromSupplier: order.IsDirectFromSupplier,
    Organization: supplierFileIdentity(order.Organization),
    Supplier: supplierFileIdentity(order.Supplier),
  } as SupplyOrderUkraineSupplierCreatePayload)
}

function supplierFileIdentity<T>(entity: T): T {
  const candidate = entity as Record<string, unknown>

  return {
    Id: candidate.Id,
    NetUid: candidate.NetUid,
  } as T
}

function snapshotJson<T>(value: T): T {
  const serialized = JSON.stringify(value)

  if (!serialized) {
    throw new Error('The supplier-file order payload is not serializable.')
  }

  return JSON.parse(serialized) as T
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value))
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => typeof child !== 'undefined')
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJson(child)]),
    )
  }

  return value
}

function getSupplierFileOwnerNetUid(): string {
  let session

  try {
    session = readSession()
  } catch {
    session = null
  }

  const ownerNetUid = session?.userNetUid || session?.user?.NetUid

  if (!ownerNetUid?.trim() || !isNonEmptyGuid(ownerNetUid.trim())) {
    throw new Error(
      'Authenticated supplier-file order owner identity is unavailable.',
    )
  }

  return ownerNetUid.trim().toLowerCase()
}

function requireSupplierFileStorage(): Storage {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
  } catch {
    // Fall through to the durable-storage error.
  }

  throw new Error(
    'Durable browser storage is required for supplier-file orders.',
  )
}

function supplierFileStorageKey(ownerNetUid: string): string {
  return `${SUPPLIER_FILE_OPERATION_STORAGE_PREFIX}:${ownerNetUid}`
}

function createSupplierFileOperationNetUid(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error(
      'Secure supplier-file operation identity is unavailable.',
    )
  }

  return globalThis.crypto.randomUUID()
}

async function sha256Text(value: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(value))
}

async function sha256Bytes(value: BufferSource): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      'Secure supplier-file payload hashing is unavailable.',
    )
  }

  const digest = await globalThis.crypto.subtle.digest('SHA-256', value)

  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('')
}

function isNonEmptyGuid(value: unknown): value is string {
  return (
    typeof value === 'string'
    && value !== '00000000-0000-0000-0000-000000000000'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
}

function isUnknownSupplierFileOutcome(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return true
  }

  const status = Number(error.status)
  return status === 0 || status === 504 || status >= 500
}

function buildSearchQuery(params: SupplyUkraineOrdersSearchParams) {
  return {
    currencyId: parseCurrencyId(params.currencyId),
    from: params.from,
    limit: params.limit,
    offset: params.offset,
    supplierName: params.supplierName?.trim() || '',
    to: toInclusiveEndOfDay(params.to),
  }
}

function parseCurrencyId(value?: string): number | undefined {
  if (!value) {
    return undefined
  }

  const currencyId = Number(value)
  if (!Number.isSafeInteger(currencyId) || currencyId <= 0) {
    throw new Error('Currency filter must contain a positive numeric ID.')
  }

  return currencyId
}

function toInclusiveEndOfDay(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T23:59:59.999`
    : value
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
  const supplyProForm = normalizeSupplyProForm(order.SupplyProForm)

  return {
    ...order,
    CreditNoteDocuments: Array.isArray(order.CreditNoteDocuments) ? order.CreditNoteDocuments : [],
    SupplyInvoices: Array.isArray(order.SupplyInvoices) ? order.SupplyInvoices.map(ensureSupplyInvoice) : [],
    SupplyOrderDeliveryDocuments: Array.isArray(order.SupplyOrderDeliveryDocuments) ? order.SupplyOrderDeliveryDocuments : [],
    SupplyOrderItems: Array.isArray(order.SupplyOrderItems) ? order.SupplyOrderItems : [],
    SupplyOrderNumber: normalizeNumberObject(order.SupplyOrderNumber),
    SupplyProForm: supplyProForm,
    SupplyProFormId: order.SupplyProFormId || supplyProForm?.Id || supplyProForm?.NetUid || null,
  }
}

function normalizeSupplyProForm(proForm: SupplyProForm | null | undefined): SupplyProForm | null {
  if (!proForm) {
    return null
  }

  return {
    ...proForm,
    InformationDeliveryProtocols: Array.isArray(proForm.InformationDeliveryProtocols)
      ? proForm.InformationDeliveryProtocols
      : [],
    PaymentDeliveryProtocols: Array.isArray(proForm.PaymentDeliveryProtocols)
      ? proForm.PaymentDeliveryProtocols
      : [],
    ProFormDocuments: Array.isArray(proForm.ProFormDocuments) ? proForm.ProFormDocuments : [],
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

function normalizeUploadedSupplyInvoice(result: unknown): SupplyInvoice | null {
  const payload = parseJsonPayload(result)
  const orderPayload = readObjectPayload(payload, ['SupplyOrder', 'SupplyOrderModel', 'Order', 'Data']) || payload
  const order = normalizeDirectSupplyOrder(orderPayload)

  if (order?.SupplyInvoices?.length) {
    return order.SupplyInvoices[order.SupplyInvoices.length - 1] || null
  }

  const invoicePayload = readObjectPayload(payload, ['SupplyInvoice', 'SupplyInvoiceModel', 'Invoice', 'Item', 'Data'])

  return normalizeSupplyInvoice(invoicePayload || payload)
}

function normalizePackingList(result: unknown): PackingList | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return ensurePackingList(result as PackingList)
}

function normalizeUploadedPackingList(result: unknown): PackingList | null {
  const payload = parseJsonPayload(result)
  const invoicePayload = readObjectPayload(payload, ['SupplyInvoice', 'SupplyInvoiceModel', 'Invoice', 'Data']) || payload
  const invoice = normalizeSupplyInvoice(invoicePayload)

  if (invoice?.PackingLists?.length) {
    return invoice.PackingLists[invoice.PackingLists.length - 1] || null
  }

  const packingListPayload = readObjectPayload(payload, ['PackingList', 'PackingListModel', 'Item', 'Data'])

  return normalizePackingList(packingListPayload || payload)
}

function ensureSupplyInvoice(invoice: SupplyInvoice): SupplyInvoice {
  return {
    ...invoice,
    InformationDeliveryProtocols: Array.isArray(invoice.InformationDeliveryProtocols)
      ? invoice.InformationDeliveryProtocols
      : [],
    InvoiceDocuments: Array.isArray(invoice.InvoiceDocuments) ? invoice.InvoiceDocuments : [],
    PackingLists: Array.isArray(invoice.PackingLists) ? invoice.PackingLists.map(ensurePackingList) : [],
    PaymentDeliveryProtocols: Array.isArray(invoice.PaymentDeliveryProtocols) ? invoice.PaymentDeliveryProtocols : [],
    SupplyInvoiceDeliveryDocuments: Array.isArray(invoice.SupplyInvoiceDeliveryDocuments)
      ? invoice.SupplyInvoiceDeliveryDocuments
      : [],
    SupplyInvoiceOrderItems: Array.isArray(invoice.SupplyInvoiceOrderItems) ? invoice.SupplyInvoiceOrderItems : [],
  }
}

function ensurePackingList(packingList: PackingList): PackingList {
  return {
    ...packingList,
    InvoiceDocuments: Array.isArray(packingList.InvoiceDocuments) ? packingList.InvoiceDocuments : [],
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

function normalizeSupplyOrderUkraineFromFileResponse(result: unknown): SupplyOrderUkraineFromFileResponse {
  const payload = parseJsonPayload(result)

  if (!payload || typeof payload !== 'object') {
    return {}
  }

  const response = payload as SupplyOrderUkraineFromFileResponse

  return {
    ...response,
    MissingVendorCodes: Array.isArray(response.MissingVendorCodes) ? response.MissingVendorCodes : [],
    SupplyOrderUkraine: response.SupplyOrderUkraine ? normalizeSupplyUkraineOrder(response.SupplyOrderUkraine) : null,
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

function readObjectPayload(result: unknown, keys: string[]): unknown | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const payload = result as Record<string, unknown>

  for (const key of keys) {
    const value = payload[key]

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value
    }
  }

  return null
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
