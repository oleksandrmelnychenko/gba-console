import { apiRequest } from '../../../shared/api/apiClient'
import { toDateTimeQuery } from '../../../shared/date/dateTime'
import type {
  ActReconciliation,
  ActReconciliationAppliedAction,
  ActReconciliationDispositionEvent,
  ActReconciliationDispositionMutationResult,
  ActReconciliationDispositionReasonCode,
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
  const result = await apiRequest<unknown>('/supplies/ukraine/reconciliation/page/registry', {
    query: {
      from: toDateTimeQuery(params.from, 'start'),
      to: toDateTimeQuery(params.to, 'end'),
    },
  })

  return normalizeReconciliations(result)
}

export async function getActReconciliationByNetId(netId: string): Promise<ActReconciliation | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/reconciliation/page/details', {
    query: { netId },
  })

  return normalizeReconciliation(result)
}

export async function getAppliedActions(netId: string): Promise<ActReconciliationAppliedAction[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/reconciliation/page/history/actions', {
    query: { netId },
  })

  return normalizeAppliedActions(result)
}

export async function getDispositionHistory(
  netId: string,
): Promise<ActReconciliationDispositionEvent[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/reconciliation/page/history/dispositions', {
    query: { netId },
  })

  return readArrayPayload(result, ['Items', 'Events', 'Data', 'Collection', 'Values']) as ActReconciliationDispositionEvent[]
}

export async function changeReconciliationDisposition({
  actNetId,
  comment,
  isDismissed,
  itemNetIds,
  operationNetUid,
  reasonCode,
}: {
  actNetId: string
  comment?: string
  isDismissed: boolean
  itemNetIds: string[]
  operationNetUid: string
  reasonCode?: ActReconciliationDispositionReasonCode
}): Promise<ActReconciliationDispositionMutationResult> {
  const result = await apiRequest<unknown>('/supplies/ukraine/reconciliation/page/disposition', {
    method: 'POST',
    query: { netId: actNetId },
    headers: { 'Idempotency-Key': operationNetUid },
    body: {
      OperationNetUid: operationNetUid,
      ItemNetIds: itemNetIds,
      IsDismissed: isDismissed,
      ReasonCode: isDismissed ? reasonCode : null,
      Comment: comment?.trim() || null,
    },
  })

  return (unwrapPayload(result) || {}) as ActReconciliationDispositionMutationResult
}

export async function getReconciliationStorages(
  organizationNetId: string,
): Promise<ReconciliationStorageOption[]> {
  const result = await apiRequest<unknown>('/storages/reconciliation-acts/details', {
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
  await apiRequest<unknown>('/products/incomes/reconciliation-acts/create', {
    method: 'POST',
    query: { ...queryParams },
  })
}

export async function createProductIncomeFromItems(
  queryParams: ProductIncomeFromItemsQueryParams,
  items: ActReconciliationItem[],
): Promise<void> {
  await apiRequest<unknown>('/products/incomes/reconciliation-acts/create/many', {
    method: 'POST',
    query: { ...queryParams },
    body: items,
  })
}

export async function createProductTransferFromItem(
  queryParams: ProductTransferFromItemQueryParams,
): Promise<void> {
  await apiRequest<unknown>('/products/transfers/reconciliation-acts/create', {
    method: 'POST',
    query: { ...queryParams },
  })
}

export async function createProductTransferFromItems(
  queryParams: ProductTransferFromItemsQueryParams,
  items: ActReconciliationItem[],
): Promise<void> {
  await apiRequest<unknown>('/products/transfers/reconciliation-acts/create/many', {
    method: 'POST',
    query: { ...queryParams },
    body: items,
  })
}

export async function createDepreciatedOrderFromItem(
  queryParams: DepreciatedOrderFromItemQueryParams,
): Promise<void> {
  await apiRequest<unknown>('/orders/depreciated/reconciliation-acts/create', {
    method: 'POST',
    query: { ...queryParams },
  })
}

export async function createDepreciatedOrderFromItems(
  queryParams: DepreciatedOrderFromItemsQueryParams,
  items: ActReconciliationItem[],
): Promise<void> {
  await apiRequest<unknown>('/orders/depreciated/reconciliation-acts/create/many', {
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
