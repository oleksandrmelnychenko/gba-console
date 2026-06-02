import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ConsumableProduct,
  ConsumablesOrder,
  ConsumablesOrderItem,
  ConsumablesStorage,
  ConsumablesStoragePayload,
  DeprecatedConsumableOrder,
  DeprecatedConsumableOrdersParams,
  DeprecatedConsumableOrderItem,
  Organization,
  PriceTotal,
  UserProfile,
} from '../types'

export async function getConsumableStorages(): Promise<ConsumablesStorage[]> {
  const result = await apiRequest<unknown>('/consumables/storages/all')

  return normalizeStorages(result)
}

export async function searchConsumableStorages(value: string): Promise<ConsumablesStorage[]> {
  const result = await apiRequest<unknown>('/consumables/storages/search', {
    query: {
      value,
    },
  })

  return normalizeStorages(result)
}

export async function getConsumableStorage(netId: string): Promise<ConsumablesStorage | null> {
  const result = await apiRequest<unknown>('/consumables/storages/get', {
    query: {
      netId,
    },
  })

  return normalizeStorage(result)
}

export async function createConsumableStorage(storage: ConsumablesStoragePayload): Promise<ConsumablesStorage | null> {
  const result = await apiRequest<unknown>('/consumables/storages/new', {
    method: 'POST',
    body: storage,
  })

  return normalizeStorage(result)
}

export async function updateConsumableStorage(storage: ConsumablesStoragePayload): Promise<ConsumablesStorage | null> {
  const result = await apiRequest<unknown>('/consumables/storages/update', {
    method: 'POST',
    body: storage,
  })

  return normalizeStorage(result)
}

export async function deleteConsumableStorage(netId: string): Promise<void> {
  await apiRequest<unknown>('/consumables/storages/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function getConsumableStorageOrganizations(): Promise<Organization[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return readArrayPayload(result, ['Items', 'Organizations', 'Organisations', 'Data']) as Organization[]
}

export async function searchConsumableStorageUsers(value: string): Promise<UserProfile[]> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/search', {
    query: {
      value,
    },
  })

  return readArrayPayload(result, ['Items', 'Users', 'Profiles', 'Data']) as UserProfile[]
}

export async function getDeprecatedConsumableOrders(
  params: DeprecatedConsumableOrdersParams,
): Promise<DeprecatedConsumableOrder[]> {
  const result = await apiRequest<unknown>('/consumables/orders/depreciated/all/filtered', {
    query: {
      from: params.from,
      storageNetId: params.storageNetId,
      to: params.to,
      value: params.value,
    },
  })

  return normalizeDeprecatedConsumableOrders(result)
}

export async function createDeprecatedConsumableOrder(
  order: DeprecatedConsumableOrder,
  expensiveFirst: boolean,
): Promise<DeprecatedConsumableOrder | null> {
  const result = await apiRequest<unknown>('/consumables/orders/depreciated/new', {
    body: order,
    method: 'POST',
    query: {
      expensiveFirst,
    },
  })

  return normalizeDeprecatedConsumableOrder(result)
}

export async function updateDeprecatedConsumableOrder(
  order: DeprecatedConsumableOrder,
  expensiveFirst: boolean,
): Promise<DeprecatedConsumableOrder | null> {
  const result = await apiRequest<unknown>('/consumables/orders/depreciated/update', {
    body: order,
    method: 'POST',
    query: {
      expensiveFirst,
    },
  })

  return normalizeDeprecatedConsumableOrder(result)
}

export async function deleteDeprecatedConsumableOrder(netId: string): Promise<void> {
  await apiRequest<unknown>('/consumables/orders/depreciated/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

function normalizeStorages(result: unknown): ConsumablesStorage[] {
  return readArrayPayload(result, ['Items', 'ConsumablesStorages', 'Storages', 'Data'])
    .map(normalizeStorage)
    .filter((storage): storage is ConsumablesStorage => Boolean(storage))
}

function normalizeStorage(result: unknown): ConsumablesStorage | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const storage = result as ConsumablesStorage

  return {
    ...storage,
    ConsumableProducts: Array.isArray(storage.ConsumableProducts)
      ? storage.ConsumableProducts
          .filter((product): product is ConsumableProduct => Boolean(product && typeof product === 'object'))
      : [],
    ConsumablesOrders: Array.isArray(storage.ConsumablesOrders)
      ? storage.ConsumablesOrders
          .map(normalizeConsumablesOrder)
          .filter((order): order is ConsumablesOrder => Boolean(order))
      : [],
    PriceTotals: Array.isArray(storage.PriceTotals)
      ? storage.PriceTotals.filter((total): total is PriceTotal => Boolean(total && typeof total === 'object'))
      : [],
  }
}

function normalizeConsumablesOrder(result: unknown): ConsumablesOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const order = result as ConsumablesOrder

  return {
    ...order,
    ConsumablesOrderItems: Array.isArray(order.ConsumablesOrderItems)
      ? order.ConsumablesOrderItems.filter(
          (item): item is ConsumablesOrderItem => Boolean(item && typeof item === 'object'),
        )
      : [],
  }
}

function normalizeDeprecatedConsumableOrders(result: unknown): DeprecatedConsumableOrder[] {
  return readArrayPayload(result, ['Items', 'DeprecatedConsumablesOrders', 'DepreciatedConsumableOrders', 'Data'])
    .map(normalizeDeprecatedConsumableOrder)
    .filter((order): order is DeprecatedConsumableOrder => Boolean(order))
}

function normalizeDeprecatedConsumableOrder(result: unknown): DeprecatedConsumableOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const order = result as DeprecatedConsumableOrder

  return {
    ...order,
    DepreciatedConsumableOrderItems: Array.isArray(order.DepreciatedConsumableOrderItems)
      ? order.DepreciatedConsumableOrderItems.filter(
          (item): item is DeprecatedConsumableOrderItem => Boolean(item && typeof item === 'object'),
        )
      : [],
    PriceTotals: Array.isArray(order.PriceTotals)
      ? order.PriceTotals.filter((total): total is PriceTotal => Boolean(total && typeof total === 'object'))
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
