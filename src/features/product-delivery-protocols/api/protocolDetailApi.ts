import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ConsumableProduct,
  Currency,
  MergedService,
  ProtocolDetail,
  SupplyExtraChargeType,
  SupplyInvoice,
  SupplyInvoiceMergedService,
  SupplyOrganization,
} from '../detailTypes'
import type { ProtocolUser, SupplyTransportationType } from '../types'

const SUPPLY_ORGANIZATION_LOOKUP_LIMIT = 20

function normalizeProtocol(result: unknown): ProtocolDetail | null {
  if (result && typeof result === 'object') {
    return result as ProtocolDetail
  }

  return null
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

export async function updateProtocolStatus(netId: string): Promise<ProtocolDetail | null> {
  const result = await apiRequest<unknown>('/delivery/product/protocol/logistic/update/status', {
    method: 'POST',
    query: { netId },
  })

  return normalizeProtocol(result)
}

export async function getApprovedInvoices(
  organizationNetId: string,
  transportationType: SupplyTransportationType,
  netId: string,
): Promise<SupplyInvoice[]> {
  const result = await apiRequest<unknown>('/supplies/invoices/product-delivery-protocol/approved', {
    query: { netId, organizationNetId, transportationType },
  })

  return readArrayPayload(result, ['Items', 'SupplyInvoices', 'Data']) as SupplyInvoice[]
}

export async function getServiceApprovedInvoices(serviceNetId: string): Promise<SupplyInvoice[]> {
  const result = await apiRequest<unknown>('/supplies/invoices/product-delivery-protocol/services', {
    query: { serviceNetId },
  })

  return readArrayPayload(result, ['Items', 'SupplyInvoices', 'Data']) as SupplyInvoice[]
}

export async function assignInvoicesToProtocol(
  protocol: ProtocolDetail,
  invoices: SupplyInvoice[],
): Promise<ProtocolDetail | null> {
  const result = await apiRequest<unknown>('/delivery/product/protocol/logistic/add/supply/invoices', {
    method: 'POST',
    body: { ...protocol, SupplyInvoices: invoices },
  })

  return normalizeProtocol(result)
}

export async function assignInvoicesToMergedService(
  service: MergedService,
  invoices: SupplyInvoice[],
): Promise<ProtocolDetail | null> {
  const result = await apiRequest<unknown>('/supplies/services/merged/product-delivery-protocol/add/supply/invoices', {
    method: 'POST',
    body: {
      ...service,
      SupplyInvoiceMergedServices: invoices.map((invoice) => ({ SupplyInvoice: invoice })),
    },
  })

  return normalizeProtocol(result)
}

export async function getSupplyInvoiceWithSpendings(netId: string): Promise<SupplyInvoice | null> {
  const result = await apiRequest<unknown>('/supplies/invoices/product-delivery-protocol/spending', {
    query: { netId },
  })

  return result && typeof result === 'object' ? (result as SupplyInvoice) : null
}

export async function addDocumentsToSupplyInvoice(
  invoice: SupplyInvoice,
  documents: File[],
): Promise<ProtocolDetail | null> {
  const formData = new FormData()
  formData.append('invoice', JSON.stringify(invoice))

  for (const document of documents) {
    formData.append('documents', document)
  }

  const result = await apiRequest<unknown>('/supplies/invoices/product-delivery-protocol/documents/add', {
    method: 'POST',
    body: formData,
  })

  return normalizeProtocol(result)
}

export type SaveMergedServiceFiles = {
  accountDocuments?: File[]
  accountingTaskDocuments?: File[]
  actDocuments?: File[]
  documents?: File[]
  taskDocuments?: File[]
}

export async function saveMergedService(
  protocolNetId: string,
  service: MergedService,
  files: SaveMergedServiceFiles,
): Promise<ProtocolDetail | null> {
  const formData = new FormData()
  formData.append('mergedServiceString', JSON.stringify(service))

  if (files.actDocuments && files.actDocuments.length > 0) {
    formData.append('act', files.actDocuments[0])
  }

  if (files.accountDocuments && files.accountDocuments.length > 0) {
    formData.append('account', files.accountDocuments[0])
  }

  for (const doc of files.documents || []) {
    formData.append('documents', doc)
  }

  for (const doc of files.taskDocuments || []) {
    formData.append('taskDocuments', doc)
  }

  for (const doc of files.accountingTaskDocuments || []) {
    formData.append('accountingTaskDocuments', doc)
  }

  const result = await apiRequest<unknown>(service.NetUid
    ? '/supplies/services/merged/product-delivery-protocol/edit'
    : '/supplies/services/merged/product-delivery-protocol/create', {
    method: 'POST',
    body: formData,
    query: { netId: protocolNetId },
  })

  return normalizeProtocol(result)
}

export async function calculateMergedServiceExtraCharge(
  params: { extraChargeType: SupplyExtraChargeType; isAuto: boolean; serviceNetId: string },
  invoices: SupplyInvoiceMergedService[],
): Promise<ProtocolDetail | null> {
  const result = await apiRequest<unknown>('/supplies/services/merged/product-delivery-protocol/calculate', {
    method: 'POST',
    body: invoices,
    query: {
      extraChargeType: params.extraChargeType,
      isAuto: params.isAuto,
      serviceNetId: params.serviceNetId,
    },
  })

  return normalizeProtocol(result)
}

export async function removeMergedService(serviceNetId: string): Promise<ProtocolDetail | null> {
  const result = await apiRequest<unknown>('/supplies/services/merged/product-delivery-protocol/delete', {
    method: 'POST',
    query: { netId: serviceNetId },
  })

  return normalizeProtocol(result)
}

export async function searchUnifiedServiceCreateSupplyOrganizations(value: string): Promise<SupplyOrganization[]> {
  return searchSupplyOrganizationsAt(
    '/supplies/organizations/product-delivery-protocols/unified-service/create/search',
    value,
  )
}

export async function searchUnifiedServiceEditSupplyOrganizations(value: string): Promise<SupplyOrganization[]> {
  return searchSupplyOrganizationsAt(
    '/supplies/organizations/product-delivery-protocols/unified-service/edit/search',
    value,
  )
}

export async function searchDirectSupplyOrderSpecificationOrganizations(value: string): Promise<SupplyOrganization[]> {
  return searchSupplyOrganizationsAt(
    '/supplies/organizations/direct-supply-order/specification/search',
    value,
  )
}

async function searchSupplyOrganizationsAt(route: string, value: string): Promise<SupplyOrganization[]> {
  const searchValue = value.trim()
  const result = await apiRequest<unknown>(route, {
    query: {
      limit: SUPPLY_ORGANIZATION_LOOKUP_LIMIT,
      offset: 0,
      ...(searchValue ? { value: searchValue } : {}),
    },
  })

  return readArrayPayload(result, ['Items', 'SupplyOrganizations', 'Organizations', 'Data']) as SupplyOrganization[]
}

export async function getSupplyServiceConsumableProducts(value = ''): Promise<ConsumableProduct[]> {
  const result = await apiRequest<unknown>('/consumables/categories/supply/services/get', {
    query: { value },
  })

  if (result && typeof result === 'object' && 'ConsumableProducts' in result) {
    const products = (result as { ConsumableProducts?: unknown }).ConsumableProducts

    return Array.isArray(products) ? (products as ConsumableProduct[]) : []
  }

  return readArrayPayload(result, ['ConsumableProducts', 'Items', 'Data']) as ConsumableProduct[]
}

export async function getUnifiedServiceCreateResponsibleUsers(): Promise<ProtocolUser[]> {
  return getResponsibleUsersAt('/usermanagement/profiles/product-delivery-protocols/unified-service/create/responsible-users')
}

export async function getUnifiedServiceEditResponsibleUsers(): Promise<ProtocolUser[]> {
  return getResponsibleUsersAt('/usermanagement/profiles/product-delivery-protocols/unified-service/edit/responsible-users')
}

async function getResponsibleUsersAt(route: string): Promise<ProtocolUser[]> {
  const result = await apiRequest<unknown>(route)

  return readArrayPayload(result, ['Items', 'Users', 'Profiles', 'Data']) as ProtocolUser[]
}

export async function getCurrencies(): Promise<Currency[]> {
  const result = await apiRequest<unknown>('/currencies/all')

  return readArrayPayload(result, ['Items', 'Currencies', 'Data']) as Currency[]
}
