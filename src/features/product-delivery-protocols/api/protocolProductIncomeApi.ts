import { apiRequest } from '../../../shared/api/apiClient'
import { requireExportDocument, type ExportDocument } from '../../../shared/documents/exportDocument'
import type {
  DynamicProductPlacementColumn,
  DynamicProductPlacementRow,
  IncomeAuditEntity,
  IncomePackingList,
  IncomeProductIncome,
  IncomeStorage,
  IncomeSupplyInvoice,
} from '../productIncomeTypes'

export type ProductIncomeApiScope = 'delivery-protocol' | 'direct-supply-order'

type ProductIncomeMutation = 'capitalize' | 'post'

function scopedPath(scope: ProductIncomeApiScope, suffix: string): string {
  return `product-income/${scope}/${suffix}`
}

function normalizeInvoice(result: unknown): IncomeSupplyInvoice {
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}

  return {
    ...(payload as IncomeSupplyInvoice),
    PackingLists: Array.isArray(payload.PackingLists)
      ? (payload.PackingLists as IncomeSupplyInvoice['PackingLists'])
      : [],
  }
}

function normalizePackingList(result: unknown): IncomePackingList {
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}

  return {
    ...(payload as IncomePackingList),
    PackingListPackageOrderItems: Array.isArray(payload.PackingListPackageOrderItems)
      ? (payload.PackingListPackageOrderItems as IncomePackingList['PackingListPackageOrderItems'])
      : [],
    DynamicProductPlacementColumns: Array.isArray(payload.DynamicProductPlacementColumns)
      ? (payload.DynamicProductPlacementColumns as DynamicProductPlacementColumn[]).map(normalizeDynamicColumn)
      : [],
  }
}

function normalizeDynamicColumn(column: DynamicProductPlacementColumn): DynamicProductPlacementColumn {
  return {
    ...column,
    DynamicProductPlacementRows: Array.isArray(column.DynamicProductPlacementRows)
      ? column.DynamicProductPlacementRows.map(normalizeDynamicRow)
      : [],
  }
}

function normalizeDynamicRow(row: DynamicProductPlacementRow): DynamicProductPlacementRow {
  return {
    ...row,
    DynamicProductPlacements: Array.isArray(row.DynamicProductPlacements)
      ? row.DynamicProductPlacements
      : [],
  }
}

export async function getSupplyOrderInvoiceItems(
  scope: ProductIncomeApiScope,
  invoiceNetId: string,
): Promise<IncomeSupplyInvoice> {
  const result = await apiRequest<unknown>(`/supplies/invoices/${scopedPath(scope, 'items')}`, {
    query: { netId: invoiceNetId },
  })

  // Deep-normalize: this endpoint (GetByNetIdWithAllIncludes) is the ONLY one that hydrates
  // each packing list's DynamicProductPlacementColumns (with rows + placements). The
  // packinglists/update response and the specification/products/get endpoint both omit them,
  // so the income page grafts the columns from here onto its (specification) packing list.
  return normalizeInvoiceWithPackingLists(result)
}

export async function getPzDocumentBySupplyInvoiceId(
  scope: ProductIncomeApiScope,
  invoiceNetId: string,
): Promise<ExportDocument> {
  const result = await apiRequest<unknown>(`/supplies/invoices/${scopedPath(scope, 'document/pz')}`, {
    query: { netId: invoiceNetId },
  })

  return requireExportDocument(result, 'Документ PZ недоступний для завантаження')
}

export async function getProductIncomeByDeliveryProtocolNetId(protocolNetId: string): Promise<IncomeProductIncome | null> {
  const result = await apiRequest<unknown>('/products/incomes/product-income/delivery-protocol/header', {
    query: { netId: protocolNetId },
  })

  return result && typeof result === 'object' ? (result as IncomeProductIncome) : null
}

export async function getProductIncomeBySupplyOrderNetId(supplyOrderNetId: string): Promise<IncomeProductIncome | null> {
  const result = await apiRequest<unknown>('/products/incomes/product-income/direct-supply-order/header', {
    query: { netId: supplyOrderNetId },
  })

  return result && typeof result === 'object' ? (result as IncomeProductIncome) : null
}

export async function getPackingListSpecificationProducts(
  scope: ProductIncomeApiScope,
  packListNetId: string,
): Promise<IncomePackingList> {
  const result = await apiRequest<unknown>(`/supplies/packinglists/${scopedPath(scope, 'specification/products')}`, {
    query: { netId: packListNetId },
  })

  return normalizePackingList(result)
}

export async function markOrderItemReadyToPlace(orderItemNetId: string, value: boolean): Promise<unknown> {
  return apiRequest<unknown>('/supplies/packinglists/item/readytoplaced/update', {
    method: 'PATCH',
    query: { netId: orderItemNetId, value },
  })
}

export async function markAllItemsReadyToPlace(
  scope: ProductIncomeApiScope,
  packListNetId: string,
): Promise<IncomePackingList> {
  const result = await apiRequest<unknown>(`/supplies/packinglists/${scopedPath(scope, 'readiness')}`, {
    method: 'PATCH',
    query: { netId: packListNetId },
  })

  return normalizePackingList(result)
}

export async function updatePackingListPlacement(
  invoiceNetId: string,
  packingList: IncomePackingList,
): Promise<IncomePackingList> {
  const result = await apiRequest<unknown>('/supplies/packinglists/placement/info/update', {
    method: 'POST',
    query: { invoiceNetId },
    body: packingList,
  })

  return normalizePackingList(result)
}

/**
 * Persist a packing list the way the legacy order flow does: POST the whole invoice
 * (with the updated packing list embedded) to /supplies/packinglists/update. Unlike
 * the placement-info endpoint, this returns the FULL invoice — its packing lists keep
 * their PackingListPackageOrderItems — so the grid is not wiped after «Додати»/«Зберегти».
 */
export async function updatePackingListInInvoice(
  scope: ProductIncomeApiScope,
  invoice: IncomeSupplyInvoice,
): Promise<IncomeSupplyInvoice> {
  const result = await apiRequest<unknown>(`/supplies/packinglists/${scopedPath(scope, 'placement')}`, {
    method: 'POST',
    body: invoice,
  })

  return normalizeInvoiceWithPackingLists(result)
}

function normalizeInvoiceWithPackingLists(result: unknown): IncomeSupplyInvoice {
  const invoice = normalizeInvoice(result)

  return {
    ...invoice,
    PackingLists: invoice.PackingLists.map((list) => normalizePackingList(list)),
  }
}

export async function updateVatOfPackListInvoiceItems(
  scope: ProductIncomeApiScope,
  invoice: IncomeSupplyInvoice,
): Promise<IncomeSupplyInvoice> {
  const result = await apiRequest<unknown>(`/supplies/invoices/${scopedPath(scope, 'vat')}`, {
    method: 'POST',
    body: invoice,
  })

  return normalizeInvoice(result)
}

/**
 * Persist a single dynamic-column row with its placements — the legacy placements
 * panel saves through these dedicated endpoints (packinglists/update only stores
 * the row qty; edited placements would be lost without them).
 */
export async function addDynamicPlacementRow(
  scope: ProductIncomeApiScope,
  row: DynamicProductPlacementRow,
): Promise<DynamicProductPlacementRow> {
  const result = await apiRequest<unknown>(
    `/supplies/ukraine/order/placements/dynamic/rows/${scopedPath(scope, 'new')}`,
    {
    method: 'POST',
    body: row,
    },
  )

  return normalizeDynamicRow(result as DynamicProductPlacementRow)
}

export async function updateDynamicPlacementRow(
  scope: ProductIncomeApiScope,
  row: DynamicProductPlacementRow,
): Promise<DynamicProductPlacementRow> {
  const result = await apiRequest<unknown>(
    `/supplies/ukraine/order/placements/dynamic/rows/${scopedPath(scope, 'update')}`,
    {
    method: 'POST',
    body: row,
    },
  )

  return normalizeDynamicRow(result as DynamicProductPlacementRow)
}

export async function createProductIncomeFromPackingListDynamic(
  scope: ProductIncomeApiScope,
  mutation: ProductIncomeMutation,
  fromDate: string,
  storageNetId: string,
  packingList: IncomePackingList,
): Promise<IncomePackingList> {
  const result = await apiRequest<unknown>(`/products/incomes/${scopedPath(scope, mutation)}`, {
    method: 'POST',
    query: { fromDate, storageNetId },
    body: packingList,
  })

  return normalizePackingList(result)
}

export async function getNonDefectiveStorages(): Promise<IncomeStorage[]> {
  const result = await apiRequest<unknown>('/storages/all/nondefective')

  return normalizeStorages(result)
}

export async function getOrganizationStorages(
  scope: ProductIncomeApiScope,
  organizationNetId: string,
): Promise<IncomeStorage[]> {
  const result = await apiRequest<unknown>(`/storages/${scopedPath(scope, 'storages')}`, {
    query: {
      organizationNetId,
      skipDefective: false,
    },
  })

  return normalizeStorages(result)
}

export async function getSupplyOrderItemAudit(supplyOrderItemNetId: string): Promise<IncomeAuditEntity[]> {
  const result = await apiRequest<unknown>('/supplies/orders/items/history/get', {
    query: {
      netId: supplyOrderItemNetId,
    },
    errorMessages: {
      default: 'Не вдалося завантажити історію ваги',
      network: 'Сервер історії ваги недоступний',
    },
  })

  return normalizeArray(result) as IncomeAuditEntity[]
}

function normalizeStorages(result: unknown): IncomeStorage[] {
  if (Array.isArray(result)) {
    return result as IncomeStorage[]
  }

  if (result && typeof result === 'object') {
    const payload = result as Record<string, unknown>

    if (Array.isArray(payload.Items)) {
      return payload.Items as IncomeStorage[]
    }

    if (Array.isArray(payload.Storages)) {
      return payload.Storages as IncomeStorage[]
    }
  }

  return []
}

function normalizeArray(result: unknown): unknown[] {
  if (Array.isArray(result)) {
    return result
  }

  if (result && typeof result === 'object') {
    const payload = result as Record<string, unknown>

    if (Array.isArray(payload.Items)) {
      return payload.Items
    }
  }

  return []
}
