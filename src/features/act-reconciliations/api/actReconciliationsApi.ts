import { apiRequest } from '../../../shared/api/apiClient'
import { toDateTimeQuery } from '../../../shared/date/dateTime'
import type {
  ActReconciliation,
  ActReconciliationAppliedAction,
  ActReconciliationItem,
  ActReconciliationsSearchParams,
  DepreciatedOrderFromItemQueryParams,
  DepreciatedOrderFromItemsQueryParams,
  ProductIncomeFromItemQueryParams,
  ProductIncomeFromItemsQueryParams,
  ProductTransferFromItemQueryParams,
  ProductTransferFromItemsQueryParams,
  ReconciliationStorageOption,
} from '../types'

export async function getActReconciliations(
  params: ActReconciliationsSearchParams,
): Promise<ActReconciliation[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/reconciliation/all/filtered', {
    query: {
      from: toDateTimeQuery(params.from, 'start'),
      to: toDateTimeQuery(params.to, 'end'),
    },
  })

  return normalizeReconciliations(result)
}

export async function getActReconciliationByNetId(netId: string): Promise<ActReconciliation | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/reconciliation/get', {
    query: { netId },
  })

  return normalizeReconciliation(result)
}

export async function getAppliedActions(netId: string): Promise<ActReconciliationAppliedAction[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/reconciliation/all/actions/applied', {
    query: { netId },
  })

  return normalizeAppliedActions(result)
}

export async function getReconciliationStorages(
  organizationNetId: string,
): Promise<ReconciliationStorageOption[]> {
  const result = await apiRequest<unknown>('/storages/get/all/filtered', {
    query: {
      organizationNetId,
      skipDefective: false,
    },
  })

  return normalizeStorages(result)
}

export async function createProductIncomeFromItem(
  queryParams: ProductIncomeFromItemQueryParams,
): Promise<void> {
  await apiRequest<unknown>('/products/incomes/new/reconciliation', {
    method: 'POST',
    query: { ...queryParams },
  })
}

export async function createProductIncomeFromItems(
  queryParams: ProductIncomeFromItemsQueryParams,
  items: ActReconciliationItem[],
): Promise<void> {
  await apiRequest<unknown>('/products/incomes/new/reconciliation/many', {
    method: 'POST',
    query: { ...queryParams },
    body: items,
  })
}

export async function createProductTransferFromItem(
  queryParams: ProductTransferFromItemQueryParams,
): Promise<void> {
  await apiRequest<unknown>('/products/transfers/new/reconciliation', {
    method: 'POST',
    query: { ...queryParams },
  })
}

export async function createProductTransferFromItems(
  queryParams: ProductTransferFromItemsQueryParams,
  items: ActReconciliationItem[],
): Promise<void> {
  await apiRequest<unknown>('/products/transfers/new/reconciliation/many', {
    method: 'POST',
    query: { ...queryParams },
    body: items,
  })
}

export async function createDepreciatedOrderFromItem(
  queryParams: DepreciatedOrderFromItemQueryParams,
): Promise<void> {
  await apiRequest<unknown>('/orders/depreciated/new/reconciliation', {
    method: 'POST',
    query: { ...queryParams },
  })
}

export async function createDepreciatedOrderFromItems(
  queryParams: DepreciatedOrderFromItemsQueryParams,
  items: ActReconciliationItem[],
): Promise<void> {
  await apiRequest<unknown>('/orders/depreciated/new/reconciliation/many', {
    method: 'POST',
    query: { ...queryParams },
    body: items,
  })
}

function normalizeReconciliations(result: unknown): ActReconciliation[] {
  return readArrayPayload(result, ['Items', 'ActReconciliations', 'Data', 'Collection', 'Values']).map((item) =>
    ensureReconciliation(item as ActReconciliation),
  )
}

function normalizeReconciliation(result: unknown): ActReconciliation | null {
  const payload = unwrapPayload(result)

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }

  return ensureReconciliation(payload as ActReconciliation)
}

function normalizeAppliedActions(result: unknown): ActReconciliationAppliedAction[] {
  return readArrayPayload(result, ['Items', 'AppliedActions', 'Data', 'Collection', 'Values']) as ActReconciliationAppliedAction[]
}

function normalizeStorages(result: unknown): ReconciliationStorageOption[] {
  return readArrayPayload(result, ['Items', 'Storages', 'Data', 'Collection', 'Values']) as ReconciliationStorageOption[]
}

function ensureReconciliation(reconciliation: ActReconciliation): ActReconciliation {
  return {
    ...reconciliation,
    ActReconciliationItems: Array.isArray(reconciliation.ActReconciliationItems)
      ? reconciliation.ActReconciliationItems.map((item) => ({
          ...item,
          Availabilities: Array.isArray(item.Availabilities) ? item.Availabilities : [],
        }))
      : [],
  }
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
