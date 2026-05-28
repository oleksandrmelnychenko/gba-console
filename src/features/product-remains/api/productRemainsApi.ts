import { apiRequest } from '../../../shared/api/apiClient'
import { buildServerSearchFilter } from '../../../shared/api/searchQuery'
import type {
  CollectionWithTotals,
  GroupedConsignment,
  GroupedConsignmentItem,
  ProductRemainStorage,
  ProductRemainSupplier,
  ProductRemainsByProductSearchParams,
  ProductRemainsExportDocument,
  ProductRemainsSearchParams,
  ProductRemainSupplierSearchParams,
  RemainingConsignment,
} from '../types'

const REMAINING_BASE = '/consignments/remaining'
const SUPPLIER_FILTER_ENTITY_TYPE = 7
const SUPPLIER_FILTER_SQL = 'RegionCode.Value/Client.FullName'

export async function getProductRemainStorages(): Promise<ProductRemainStorage[]> {
  const result = await apiRequest<unknown>('/storages/get/all')

  return normalizeStorages(result)
}

export async function getProductRemainSuppliers(
  params: ProductRemainSupplierSearchParams,
  signal?: AbortSignal,
): Promise<ProductRemainSupplier[]> {
  const result = await apiRequest<unknown>('/search/by/query', {
    query: {
      filter: buildSupplierSearchFilter(params),
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeSuppliers(result)
}

export async function getGroupedProductRemains(
  params: ProductRemainsSearchParams,
): Promise<CollectionWithTotals<GroupedConsignment>> {
  const result = await apiRequest<unknown>(`${REMAINING_BASE}/grouped/storage/filtered`, {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      storageNetId: params.storageNetId,
      supplierNetId: params.supplierNetId,
      to: params.to,
    },
  })

  return normalizeCollectionWithTotals(result, ensureGroupedConsignment)
}

export async function getProductRemains(
  params: ProductRemainsByProductSearchParams,
): Promise<CollectionWithTotals<RemainingConsignment>> {
  const result = await apiRequest<unknown>(`${REMAINING_BASE}/all/storage/filtered`, {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      searchValue: params.searchValue.trim(),
      storageNetId: params.storageNetId,
      supplierNetId: params.supplierNetId,
      to: params.to,
    },
  })

  return normalizeCollectionWithTotals(result, ensureRemainingConsignment)
}

export async function exportGroupedProductRemains(
  params: Omit<ProductRemainsSearchParams, 'limit' | 'offset'>,
): Promise<ProductRemainsExportDocument> {
  const result = await apiRequest<unknown>(`${REMAINING_BASE}/grouped/storage/document/export`, {
    query: {
      from: params.from,
      storageNetId: params.storageNetId,
      supplierNetId: params.supplierNetId,
      to: params.to,
    },
  })

  return normalizeExportDocument(result)
}

export async function exportProductRemains(
  params: Omit<ProductRemainsByProductSearchParams, 'limit' | 'offset'>,
): Promise<ProductRemainsExportDocument> {
  const result = await apiRequest<unknown>(`${REMAINING_BASE}/document/export`, {
    query: {
      from: params.from,
      searchValue: params.searchValue.trim(),
      storageNetId: params.storageNetId,
      supplierNetId: params.supplierNetId,
      to: params.to,
    },
  })

  return normalizeExportDocument(result)
}

function buildSupplierSearchFilter(params: ProductRemainSupplierSearchParams): string {
  return buildServerSearchFilter({
    table: 'Client',
    offset: params.offset,
    limit: params.limit,
    value: params.value.trim(),
    filterEntityType: SUPPLIER_FILTER_ENTITY_TYPE,
    filterSql: SUPPLIER_FILTER_SQL,
  })
}

function normalizeCollectionWithTotals<TItem>(
  result: unknown,
  ensureItem: (item: TItem) => TItem,
): CollectionWithTotals<TItem> {
  if (!result || typeof result !== 'object') {
    return {
      Collection: [],
    }
  }

  const payload = result as Record<string, unknown>
  const collection = readArray(payload, 'Collection') || readArray(payload, 'Items') || readArray(payload, 'Data') || []

  return {
    AccountingTotalAmount: readNumber(payload.AccountingTotalAmount),
    AccountingTotalAmountFiltered: readNumber(payload.AccountingTotalAmountFiltered),
    AccountingTotalAmountLocal: readNumber(payload.AccountingTotalAmountLocal),
    AccountingTotalAmountLocalFiltered: readNumber(payload.AccountingTotalAmountLocalFiltered),
    Collection: (collection as TItem[]).map(ensureItem),
    TotalAmount: readNumber(payload.TotalAmount),
    TotalAmountFiltered: readNumber(payload.TotalAmountFiltered),
    TotalAmountLocal: readNumber(payload.TotalAmountLocal),
    TotalAmountLocalFiltered: readNumber(payload.TotalAmountLocalFiltered),
    TotalQty: readNumber(payload.TotalQty),
    TotalQtyFiltered: readNumber(payload.TotalQtyFiltered),
  }
}

function normalizeStorages(result: unknown): ProductRemainStorage[] {
  if (Array.isArray(result)) {
    return result as ProductRemainStorage[]
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>
  const storages = readArray(payload, 'Items') || readArray(payload, 'Storages') || readArray(payload, 'Collection') || []

  return storages as ProductRemainStorage[]
}

function normalizeSuppliers(result: unknown): ProductRemainSupplier[] {
  if (Array.isArray(result)) {
    return result as ProductRemainSupplier[]
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>
  const suppliers = readArray(payload, 'Items') || readArray(payload, 'Clients') || readArray(payload, 'Data') || []

  return suppliers as ProductRemainSupplier[]
}

function normalizeExportDocument(result: unknown): ProductRemainsExportDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL: typeof payload.PdfDocumentURL === 'string' ? payload.PdfDocumentURL : '',
  }
}

function ensureGroupedConsignment(consignment: GroupedConsignment): GroupedConsignment {
  return {
    ...consignment,
    GroupedConsignmentItems: Array.isArray(consignment.GroupedConsignmentItems)
      ? consignment.GroupedConsignmentItems.map(ensureGroupedConsignmentItem)
      : [],
  }
}

function ensureGroupedConsignmentItem(item: GroupedConsignmentItem): GroupedConsignmentItem {
  return {
    ...item,
    Product: item.Product || null,
  }
}

function ensureRemainingConsignment(consignment: RemainingConsignment): RemainingConsignment {
  return {
    ...consignment,
    Product: consignment.Product || null,
  }
}

function readArray(payload: Record<string, unknown>, key: string): unknown[] | null {
  const value = payload[key]

  return Array.isArray(value) ? value : null
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
