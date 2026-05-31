import { apiRequest } from '../../../shared/api/apiClient'
import type { IncomeAuditEntity, IncomePackingList, IncomeStorage, IncomeSupplyInvoice } from '../productIncomeTypes'

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
      ? (payload.DynamicProductPlacementColumns as IncomePackingList['DynamicProductPlacementColumns'])
      : [],
  }
}

export async function getSupplyOrderInvoiceItems(invoiceNetId: string): Promise<IncomeSupplyInvoice> {
  const result = await apiRequest<unknown>('/supplies/invoices/items/get', {
    query: { netId: invoiceNetId },
  })

  return normalizeInvoice(result)
}

export async function getPackingListSpecificationProducts(packListNetId: string): Promise<IncomePackingList> {
  const result = await apiRequest<unknown>('/supplies/packinglists/specification/products/get', {
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

export async function markAllItemsReadyToPlace(packListNetId: string): Promise<IncomePackingList> {
  const result = await apiRequest<unknown>('/supplies/packinglists/item/readytoplaced/update/all', {
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

export async function updateVatOfPackListInvoiceItems(invoice: IncomeSupplyInvoice): Promise<IncomeSupplyInvoice> {
  const result = await apiRequest<unknown>('/supplies/invoices/items/update/vat', {
    method: 'POST',
    body: invoice,
  })

  return normalizeInvoice(result)
}

export async function createUkraineProductIncomeFromDynamic(
  fromDate: string,
  storageNetId: string,
  packingList: IncomePackingList,
): Promise<unknown> {
  return apiRequest<unknown>('/products/incomes/new/supply/ukraine/dynamic', {
    method: 'POST',
    query: { fromDate, storageNetId },
    body: packingList,
  })
}

export async function getNonDefectiveStorages(): Promise<IncomeStorage[]> {
  const result = await apiRequest<unknown>('/storages/all/nondefective')

  return normalizeStorages(result)
}

export async function getOrganizationStorages(organizationNetId: string): Promise<IncomeStorage[]> {
  const result = await apiRequest<unknown>('/storages/get/all/filtered', {
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
