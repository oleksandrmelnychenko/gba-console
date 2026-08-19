import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ConsumableProduct,
  MergedService,
  ProtocolUser,
  SupplyOrderUkraine,
  SupplyOrderUkrainePaymentDeliveryProtocol,
  SupplyOrderUkrainePaymentDeliveryProtocolKey,
  SupplyPaymentTask,
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
  const result = await apiRequest<unknown>('/supplies/ukraine/order/payment-protocols/details', {
    query: { netId },
  })

  return normalizeOrder(result)
}

export async function createSupplyOrderUkrainePaymentProtocol(
  netId: string,
  protocol: SupplyOrderUkrainePaymentDeliveryProtocol,
): Promise<SupplyOrderUkraine | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/payment-protocols/create', {
    method: 'POST',
    body: protocol,
    query: { netId },
  })

  return normalizeOrder(result)
}

export async function deleteSupplyOrderUkrainePaymentProtocol(
  netId: string,
  protocol: SupplyOrderUkrainePaymentDeliveryProtocol,
): Promise<SupplyOrderUkraine | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/payment-protocols/delete', {
    method: 'POST',
    body: protocol,
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

function mergedServiceIdentity(orderNetUid: string, service: MergedService) {
  return {
    OrderNetUid: orderNetUid,
    ServiceId: service.Id || 0,
    ServiceNetUid: service.NetUid || '00000000-0000-0000-0000-000000000000',
  }
}

export async function createUkraineMergedServicePaymentTask(
  orderNetUid: string,
  service: MergedService,
  paymentTask: SupplyPaymentTask,
  isAccounting: boolean,
): Promise<SupplyOrderUkraine | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/merged-services/payment-tasks/create', {
    method: 'POST',
    body: {
      ...mergedServiceIdentity(orderNetUid, service),
      IsAccounting: isAccounting,
      PaymentTask: paymentTask,
    },
  })

  return normalizeOrder(result)
}

export async function deleteUkraineMergedServicePaymentTask(
  orderNetUid: string,
  service: MergedService,
  paymentTask: SupplyPaymentTask,
  isAccounting: boolean,
): Promise<SupplyOrderUkraine | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/merged-services/payment-tasks/delete', {
    method: 'POST',
    body: {
      ...mergedServiceIdentity(orderNetUid, service),
      IsAccounting: isAccounting,
      PaymentTask: {
        Id: paymentTask.Id || 0,
        NetUid: paymentTask.NetUid || '00000000-0000-0000-0000-000000000000',
      },
    },
  })

  return normalizeOrder(result)
}

export async function deleteUkraineMergedService(
  orderNetUid: string,
  service: MergedService,
): Promise<SupplyOrderUkraine | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/merged-services/delete', {
    method: 'POST',
    body: mergedServiceIdentity(orderNetUid, service),
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
  const result = await apiRequest<unknown>('/supplies/ukraine/order/payment-protocols/keys')

  return readArrayPayload(result, ['Items', 'Keys', 'Data']) as SupplyOrderUkrainePaymentDeliveryProtocolKey[]
}

export async function getResponsibleUsers(): Promise<ProtocolUser[]> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/orders-ukraine/payment-protocols/users', {
    query: { types: 7 },
  })

  return readArrayPayload(result, ['Items', 'Users', 'Profiles', 'Data']) as ProtocolUser[]
}

export async function getLogisticPaymentTaskResponsibleUsers(): Promise<ProtocolUser[]> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/orders-ukraine/logistic-way/payment-task-users', {
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
