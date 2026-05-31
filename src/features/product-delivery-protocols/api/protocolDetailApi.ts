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
  const result = await apiRequest<unknown>('/delivery/product/protocol/update/status', {
    method: 'POST',
    body: { netId },
  })

  return normalizeProtocol(result)
}

export async function getApprovedInvoices(
  organizationNetId: string,
  transportationType: SupplyTransportationType,
  netId: string,
): Promise<SupplyInvoice[]> {
  const result = await apiRequest<unknown>('/supplies/invoices/approved', {
    query: { netId, organizationNetId, transportationType },
  })

  return readArrayPayload(result, ['Items', 'SupplyInvoices', 'Data']) as SupplyInvoice[]
}

export async function getServiceApprovedInvoices(serviceNetId: string): Promise<SupplyInvoice[]> {
  const result = await apiRequest<unknown>('/supplies/invoices/get/by/services', {
    query: { serviceNetId },
  })

  return readArrayPayload(result, ['Items', 'SupplyInvoices', 'Data']) as SupplyInvoice[]
}

export async function assignInvoicesToProtocol(
  protocol: ProtocolDetail,
  invoices: SupplyInvoice[],
): Promise<ProtocolDetail | null> {
  const result = await apiRequest<unknown>('/delivery/product/protocol/add/supply/invoices', {
    method: 'POST',
    body: { ...protocol, SupplyInvoices: invoices },
  })

  return normalizeProtocol(result)
}

export async function assignInvoicesToMergedService(
  service: MergedService,
  invoices: SupplyInvoice[],
): Promise<ProtocolDetail | null> {
  const result = await apiRequest<unknown>('/supplies/services/merged/add/supply/invoices', {
    method: 'POST',
    body: {
      ...service,
      SupplyInvoiceMergedServices: invoices.map((invoice) => ({ SupplyInvoice: invoice })),
    },
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

  const result = await apiRequest<unknown>('/supplies/services/merged/manage', {
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
  const result = await apiRequest<unknown>('/supplies/services/merged/update/extra/charge', {
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
  const result = await apiRequest<unknown>('/supplies/services/merged/remove/before/calculated/gross/price', {
    method: 'POST',
    body: { netId: serviceNetId },
  })

  return normalizeProtocol(result)
}

export async function getSupplyOrganizations(): Promise<SupplyOrganization[]> {
  const result = await apiRequest<unknown>('/supplies/organizations/all')

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

export async function getResponsibleUsers(): Promise<ProtocolUser[]> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/all/by', {
    query: { types: 7 },
  })

  return readArrayPayload(result, ['Items', 'Users', 'Profiles', 'Data']) as ProtocolUser[]
}

export async function getCurrencies(): Promise<Currency[]> {
  const result = await apiRequest<unknown>('/currencies/all')

  return readArrayPayload(result, ['Items', 'Currencies', 'Data']) as Currency[]
}
