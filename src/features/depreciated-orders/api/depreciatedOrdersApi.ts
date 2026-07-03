import { apiRequest } from '../../../shared/api/apiClient'
import type {
  DepreciatedOrder,
  DepreciatedOrderCreateFromFilePayload,
  DepreciatedOrderCreateFromFileResult,
  DepreciatedOrderExportDocument,
  DepreciatedOrdersResponse,
  DepreciatedOrderStorage,
  DepreciatedOrdersSearchParams,
} from '../types'

export async function getDepreciatedOrders(params: DepreciatedOrdersSearchParams): Promise<DepreciatedOrdersResponse> {
  const result = await apiRequest<unknown>('/orders/depreciated/all/filtered', {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      to: params.to,
    },
  })

  return normalizeDepreciatedOrdersResponse(result)
}

export async function getDepreciatedOrderByNetId(netId: string): Promise<DepreciatedOrder | null> {
  const result = await apiRequest<unknown>('/orders/depreciated/get', {
    query: {
      netId,
    },
  })

  return normalizeDepreciatedOrder(result)
}

export async function getDepreciatedOrderStorages(): Promise<DepreciatedOrderStorage[]> {
  const result = await apiRequest<unknown>('/storages/get/all')

  return normalizeStorages(result)
}

export async function exportDepreciatedOrderDocument(netId: string): Promise<DepreciatedOrderExportDocument> {
  const result = await apiRequest<unknown>('/orders/depreciated/document/export', {
    query: {
      netId,
    },
  })

  return normalizeExportDocument(result)
}

export async function createDepreciatedOrderFromFile(
  payload: DepreciatedOrderCreateFromFilePayload,
): Promise<DepreciatedOrderCreateFromFileResult> {
  const formData = new FormData()
  formData.append('parseConfiguration', JSON.stringify(payload.parseConfiguration))
  formData.append('depreciatedOrderInString', JSON.stringify(payload.depreciatedOrder))
  formData.append('file', payload.file)

  const result = await apiRequest<unknown>('/orders/depreciated/file/new', {
    method: 'POST',
    body: formData,
  })

  const exceptions = normalizeExceptions(result)

  return {
    exceptions,
    message: '',
  }
}

function normalizeDepreciatedOrdersResponse(result: unknown): DepreciatedOrdersResponse {
  const items = normalizeDepreciatedOrders(result)
  const payload = result && typeof result === 'object' && !Array.isArray(result) ? (result as Record<string, unknown>) : {}
  const totalQty =
    readNumber(payload.TotalRowsQty) ??
    readNumber(payload.TotalQty) ??
    readNumber(payload.Total) ??
    readNumber(payload.Count) ??
    readNumber(items[0]?.TotalRowsQty) ??
    items.length

  return { items, totalQty }
}

function normalizeDepreciatedOrders(result: unknown): DepreciatedOrder[] {
  if (Array.isArray(result)) {
    return result.map(ensureDepreciatedOrder)
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>
  const items = Array.isArray(payload.Items)
    ? payload.Items
    : Array.isArray(payload.DepreciatedOrders)
      ? payload.DepreciatedOrders
      : Array.isArray(payload.Data)
        ? payload.Data
        : []

  return (items as DepreciatedOrder[]).map(ensureDepreciatedOrder)
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return null
}

function normalizeDepreciatedOrder(result: unknown): DepreciatedOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return ensureDepreciatedOrder(result as DepreciatedOrder)
}

function normalizeStorages(result: unknown): DepreciatedOrderStorage[] {
  if (Array.isArray(result)) {
    return result as DepreciatedOrderStorage[]
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  if (Array.isArray(payload.Items)) {
    return payload.Items as DepreciatedOrderStorage[]
  }

  if (Array.isArray(payload.Storages)) {
    return payload.Storages as DepreciatedOrderStorage[]
  }

  if (Array.isArray(payload.Collection)) {
    return payload.Collection as DepreciatedOrderStorage[]
  }

  return []
}

function normalizeExportDocument(result: unknown): DepreciatedOrderExportDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL: typeof payload.PdfDocumentURL === 'string' ? payload.PdfDocumentURL : '',
  }
}

function normalizeExceptions(result: unknown): string[] {
  if (Array.isArray(result)) {
    return toStringList(result)
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  if (Array.isArray(payload.Exceptions)) {
    return toStringList(payload.Exceptions)
  }

  if (Array.isArray(payload.NotArrivedProducts)) {
    return toStringList(payload.NotArrivedProducts)
  }

  if (Array.isArray(payload.MissingVendorCodes)) {
    return toStringList(payload.MissingVendorCodes)
  }

  return []
}

function toStringList(values: unknown[]): string[] {
  return values.reduce<string[]>((items, value) => {
    const text = String(value).trim()

    if (text) {
      items.push(text)
    }

    return items
  }, [])
}

function ensureDepreciatedOrder(depreciatedOrder: DepreciatedOrder): DepreciatedOrder {
  return {
    ...depreciatedOrder,
    DepreciatedOrderItems: Array.isArray(depreciatedOrder.DepreciatedOrderItems)
      ? depreciatedOrder.DepreciatedOrderItems.map((item) => ({
          ...item,
          ProductLocations: Array.isArray(item.ProductLocations) ? item.ProductLocations : [],
        }))
      : [],
  }
}
