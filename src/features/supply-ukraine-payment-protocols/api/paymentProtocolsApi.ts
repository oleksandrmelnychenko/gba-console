import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ConsumableProduct,
  MergedService,
  ProtocolUser,
  SupplyOrderUkraine,
  SupplyOrderUkrainePaymentDeliveryProtocolKey,
  SupplyOrganization,
} from '../types'

const SUPPLY_ORGANIZATION_LOOKUP_LIMIT = 20

function normalizeOrder(result: unknown): SupplyOrderUkraine | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const order = result as SupplyOrderUkraine

  return {
    ...order,
    MergedServices: Array.isArray(order.MergedServices) ? order.MergedServices : [],
    SupplyOrderUkrainePaymentDeliveryProtocols: Array.isArray(order.SupplyOrderUkrainePaymentDeliveryProtocols)
      ? order.SupplyOrderUkrainePaymentDeliveryProtocols
      : [],
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

export async function getSupplyOrderUkraineById(netId: string): Promise<SupplyOrderUkraine | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/get', {
    query: { netId },
  })

  return normalizeOrder(result)
}

export async function updateSupplyOrderUkraine(order: SupplyOrderUkraine): Promise<SupplyOrderUkraine | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/update', {
    method: 'POST',
    body: order,
  })

  return normalizeOrder(result)
}

export async function uploadUkraineMergedService(
  orderNetId: string,
  service: MergedService,
  documents: File[],
): Promise<SupplyOrderUkraine | null> {
  const formData = new FormData()
  formData.append('entity', JSON.stringify(service))

  for (const document of documents) {
    formData.append('documents', document)
  }

  const result = await apiRequest<unknown>('/supplies/services/merged/upload/documents/ukraine', {
    method: 'POST',
    body: formData,
    query: { netId: orderNetId },
  })

  return normalizeOrder(result)
}

export async function getSupplyOrderUkraineProtocolKeys(): Promise<SupplyOrderUkrainePaymentDeliveryProtocolKey[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/protocols/keys/all')

  return readArrayPayload(result, ['Items', 'Keys', 'Data']) as SupplyOrderUkrainePaymentDeliveryProtocolKey[]
}

export async function getResponsibleUsers(): Promise<ProtocolUser[]> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/all/by', {
    query: { types: 7 },
  })

  return readArrayPayload(result, ['Items', 'Users', 'Profiles', 'Data']) as ProtocolUser[]
}

export async function searchSupplyOrganizations(value: string): Promise<SupplyOrganization[]> {
  const searchValue = value.trim()

  if (!searchValue) {
    return []
  }

  const result = await apiRequest<unknown>('/supplies/organizations/all/search', {
    query: {
      limit: SUPPLY_ORGANIZATION_LOOKUP_LIMIT,
      offset: 0,
      value: searchValue,
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
