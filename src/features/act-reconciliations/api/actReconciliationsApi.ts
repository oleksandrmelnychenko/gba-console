import { apiRequest } from '../../../shared/api/apiClient'
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
      from: params.from,
      to: params.to,
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
  if (Array.isArray(result)) {
    return result.map(ensureReconciliation)
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>
  const items = Array.isArray(payload.Items)
    ? payload.Items
    : Array.isArray(payload.ActReconciliations)
      ? payload.ActReconciliations
      : Array.isArray(payload.Data)
        ? payload.Data
        : []

  return (items as ActReconciliation[]).map(ensureReconciliation)
}

function normalizeReconciliation(result: unknown): ActReconciliation | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return ensureReconciliation(result as ActReconciliation)
}

function normalizeAppliedActions(result: unknown): ActReconciliationAppliedAction[] {
  if (Array.isArray(result)) {
    return result as ActReconciliationAppliedAction[]
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  if (Array.isArray(payload.Items)) {
    return payload.Items as ActReconciliationAppliedAction[]
  }

  if (Array.isArray(payload.AppliedActions)) {
    return payload.AppliedActions as ActReconciliationAppliedAction[]
  }

  return []
}

function normalizeStorages(result: unknown): ReconciliationStorageOption[] {
  if (Array.isArray(result)) {
    return result as ReconciliationStorageOption[]
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  if (Array.isArray(payload.Items)) {
    return payload.Items as ReconciliationStorageOption[]
  }

  if (Array.isArray(payload.Storages)) {
    return payload.Storages as ReconciliationStorageOption[]
  }

  if (Array.isArray(payload.Collection)) {
    return payload.Collection as ReconciliationStorageOption[]
  }

  return []
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
