import { apiRequest } from '../../../shared/api/apiClient'
import type { ServerBooleanFilter } from '../../../shared/api/searchQuery'
import { buildServerSearchFilter } from '../../../shared/api/searchQuery'
import type { Client, ClientFilterItem, ClientPrintDocument, ClientSearchParams, ClientType } from '../types'

const CLIENT_SEARCH_SQL = 'RegionCode.Value/Client.FullName/Client.USREOU'
const SUPPLIER_SEARCH_SQL = 'RegionCode.Value/Client.FullName'
const CLIENT_FILTER_ENTITY_TYPE_CLIENT = 0
const CLIENT_FILTER_ENTITY_TYPE_SUPPLIER = 7
const CLIENT_TYPE_BUYER = 0
const CLIENT_TYPE_PROVIDER = 1

export async function getClients(
  params: ClientSearchParams,
  signal?: AbortSignal,
): Promise<Client[]> {
  const result = await apiRequest<unknown>('/clients/all/filtered', {
    query: {
      active: params.active,
      filterSql: params.filterSql || CLIENT_SEARCH_SQL,
      ...(params.forReSale !== null && typeof params.forReSale !== 'undefined'
        ? { forReSale: params.forReSale }
        : {}),
      limit: params.limit,
      offset: params.offset,
      typeRoleFilter: params.typeRoleFilter,
      value: params.value?.trim() || '',
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeClients(result)
}

export async function getSuppliers(
  params: ClientSearchParams,
  signal?: AbortSignal,
): Promise<Client[]> {
  const result = await apiRequest<unknown>('/clients/suppliers/all/filtered', {
    query: {
      active: params.active,
      filterSql: params.filterSql || SUPPLIER_SEARCH_SQL,
      limit: params.limit,
      offset: params.offset,
      typeRoleFilter: params.typeRoleFilter,
      value: params.value?.trim() || '',
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeClients(result)
}

export async function getClientCount(type = CLIENT_TYPE_BUYER): Promise<number> {
  const result = await apiRequest<unknown>('/clients/get/total', {
    query: {
      type,
    },
  })

  return normalizeCount(result)
}

export async function getSupplierCount(): Promise<number> {
  return getClientCount(CLIENT_TYPE_PROVIDER)
}

export async function getClientTypes(): Promise<ClientType[]> {
  const result = await apiRequest<unknown>('/clients/types/all')

  return Array.isArray(result) ? (result as ClientType[]) : []
}

export async function getClientFilterItems(): Promise<ClientFilterItem[]> {
  return getFilterItems(CLIENT_FILTER_ENTITY_TYPE_CLIENT)
}

export async function getSupplierFilterItems(): Promise<ClientFilterItem[]> {
  return getFilterItems(CLIENT_FILTER_ENTITY_TYPE_SUPPLIER)
}

async function getFilterItems(type: number): Promise<ClientFilterItem[]> {
  const result = await apiRequest<unknown>('/filteritems/all', {
    query: {
      type,
    },
  })

  return normalizeFilterItems(result)
}

export async function exportClientsDocument(params: ClientSearchParams): Promise<ClientPrintDocument | null> {
  const result = await apiRequest<unknown>('/clients/document', {
    query: {
      filter: buildClientsSearchFilter(params),
    },
  })

  return normalizeDocument(result)
}

export async function exportSuppliersDocument(params: ClientSearchParams): Promise<ClientPrintDocument | null> {
  const result = await apiRequest<unknown>('/clients/document', {
    query: {
      filter: buildClientsSearchFilter({
        ...params,
        filterEntityType: params.filterEntityType ?? CLIENT_FILTER_ENTITY_TYPE_SUPPLIER,
      }),
    },
  })

  return normalizeDocument(result)
}

export async function switchClientActiveState(netId: string): Promise<void> {
  await apiRequest<unknown>('/clients/switch/active', {
    query: {
      netId,
    },
  })
}

export async function updateClientOrderExpireDays(clientNetId: string, days: number): Promise<void> {
  await apiRequest<unknown>('/clients/update/order/expire', {
    method: 'POST',
    query: {
      clientNetId,
      days,
    },
    body: {},
  })
}

export function buildClientsSearchFilter(params: ClientSearchParams): string {
  const searchValue = params.value?.trim() || ''
  const booleanFilter = buildActiveFilter(params.active)
  const filterEntityType = params.filterEntityType ?? CLIENT_FILTER_ENTITY_TYPE_CLIENT
  const hasSortDescriptors = Boolean(params.sortDescriptors?.length)
  const hasScopedFilters = Boolean(
    booleanFilter
      || params.typeRoleFilter
      || hasSortDescriptors
      || params.forReSale !== null && typeof params.forReSale !== 'undefined'
      || filterEntityType !== CLIENT_FILTER_ENTITY_TYPE_CLIENT,
  )
  const shouldSendFilter = Boolean(searchValue || hasScopedFilters)

  return buildServerSearchFilter({
    table: 'Client',
    offset: params.offset,
    limit: params.limit,
    value: searchValue,
    filterEntityType,
    filterSql: shouldSendFilter ? params.filterSql || CLIENT_SEARCH_SQL : undefined,
    filterOperationSql: params.filterOperationSql,
    booleanFilter,
    sortDescriptors: params.sortDescriptors,
    typeRoleFilter: params.typeRoleFilter,
    extra: {
      forReSale: params.forReSale ?? null,
    },
  })
}

function normalizeClients(result: unknown): Client[] {
  if (Array.isArray(result)) {
    return result as Client[]
  }

  if (result && typeof result === 'object' && 'Items' in result && Array.isArray(result.Items)) {
    return result.Items as Client[]
  }

  return []
}

function normalizeDocument(result: unknown): ClientPrintDocument | null {
  if (result && typeof result === 'object') {
    return result as ClientPrintDocument
  }

  return null
}

function normalizeFilterItems(result: unknown): ClientFilterItem[] {
  if (Array.isArray(result)) {
    return result as ClientFilterItem[]
  }

  if (result && typeof result === 'object' && 'Items' in result && Array.isArray(result.Items)) {
    return result.Items as ClientFilterItem[]
  }

  return []
}

function normalizeCount(result: unknown): number {
  if (typeof result === 'number') {
    return parseCount(result)
  }

  if (typeof result === 'string') {
    return parseCount(result)
  }

  if (result && typeof result === 'object') {
    const count = (result as { Count?: unknown; Total?: unknown; Value?: unknown }).Count
      ?? (result as { Count?: unknown; Total?: unknown; Value?: unknown }).Total
      ?? (result as { Count?: unknown; Total?: unknown; Value?: unknown }).Value

    return parseCount(count)
  }

  return 0
}

function parseCount(count: unknown): number {
  if (typeof count === 'number') {
    return Number.isFinite(count) ? count : 0
  }

  if (typeof count === 'string') {
    const parsed = Number(count)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function buildActiveFilter(active?: boolean | null): ServerBooleanFilter | null {
  if (active === null || typeof active === 'undefined') {
    return null
  }

  return {
    CssClass: active ? 'active_clients' : 'inactive_clients',
    Name: active ? 'ShowOnlyActive' : 'ShowOnlyInactive',
    SQL: 'IsActive',
    Value: active,
  }
}
