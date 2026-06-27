import { apiRequest } from '../../../shared/api/apiClient'
import { normalizeDisplayNumber } from '../../../shared/supplyUkraineOrderNumbers'
import type {
  ProductIncomeDocument,
  ProductIncomeDocumentsExportDocument,
  ProductIncomeDocumentsResponse,
  ProductIncomeDocumentsSearchParams,
  ProductIncomeInfo,
  ProductIncomeItem,
  ProductIncomePackingList,
  RemainingConsignment,
} from '../types'

export async function getProductIncomeDocuments(
  params: ProductIncomeDocumentsSearchParams,
): Promise<ProductIncomeDocumentsResponse> {
  const result = await apiRequest<unknown>('/products/incomes/all', {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      to: params.to,
      value: params.value?.trim() || '',
    },
  })

  return normalizeProductIncomeDocumentsResponse(result)
}

export async function exportProductIncomeDocument(
  netId: string,
): Promise<ProductIncomeDocumentsExportDocument> {
  const result = await apiRequest<unknown>('/products/incomes/document/export', {
    query: {
      netId,
    },
  })

  return normalizeExportDocument(result)
}

export async function getProductIncomeInfo(netId: string): Promise<ProductIncomeInfo | null> {
  const result = await apiRequest<unknown>('/products/incomes/get', {
    query: {
      netId,
    },
  })

  return normalizeProductIncomeInfo(result)
}

export async function getSupplyOrderProductIncomeByNetId(netId: string): Promise<ProductIncomeInfo | null> {
  const result = await apiRequest<unknown>('/products/incomes/supply/order/get', {
    query: {
      netId,
    },
  })

  return normalizeProductIncomeInfo(result)
}

export async function getSupplyOrderUkraineProductIncomeByNetId(netId: string): Promise<ProductIncomeInfo | null> {
  const result = await apiRequest<unknown>('/products/incomes/supply/order/ukraine/get', {
    query: {
      netId,
    },
  })

  return normalizeProductIncomeInfo(result)
}

export async function getProductIncomeRemainings(netId: string): Promise<RemainingConsignment[]> {
  const result = await apiRequest<unknown>('/consignments/remaining/all/income', {
    query: {
      netId,
    },
  })

  return readArrayPayload(result, ['Items', 'Remainings', 'Consignments', 'Data']) as RemainingConsignment[]
}

function normalizeProductIncomeDocumentsResponse(result: unknown): ProductIncomeDocumentsResponse {
  const items = readArrayPayload(result, ['Items', 'ProductIncomes', 'Documents', 'Data']).map((item) =>
    normalizeProductIncomeDocument(item as ProductIncomeDocument),
  )
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}
  const total = readNumber(payload.Total, readNumber(payload.TotalRowQty, readNumber(payload.TotalRowsQty)))
    ?? readNumber(items[0]?.TotalRowQty, readNumber(items[0]?.TotalRowsQty))

  return {
    Items: items,
    Total: total,
  }
}

function normalizeProductIncomeDocument(document: ProductIncomeDocument): ProductIncomeDocument {
  return {
    ...document,
    ProductIncomeItems: normalizeProductIncomeItems(document.ProductIncomeItems),
  }
}

function normalizeProductIncomeInfo(result: unknown): ProductIncomeInfo | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const info = result as ProductIncomeInfo

  return {
    ...info,
    PackingList: normalizeProductIncomePackingList(info.PackingList),
    ProductIncomeItems: normalizeProductIncomeItems(info.ProductIncomeItems).map(normalizeProductIncomeItem),
  }
}

function normalizeProductIncomeItems(items?: ProductIncomeItem[]): ProductIncomeItem[] {
  return Array.isArray(items) ? items : []
}

function normalizeProductIncomeItem(item: ProductIncomeItem): ProductIncomeItem {
  return {
    ...item,
    PackingListPackageOrderItem: item.PackingListPackageOrderItem
      ? {
          ...item.PackingListPackageOrderItem,
          PackingList: normalizeProductIncomePackingList(item.PackingListPackageOrderItem.PackingList),
        }
      : item.PackingListPackageOrderItem,
    SupplyOrderUkraineItem: item.SupplyOrderUkraineItem
      ? {
          ...item.SupplyOrderUkraineItem,
          SupplyOrderUkraine: normalizeSupplyOrderUkraineNumber(item.SupplyOrderUkraineItem.SupplyOrderUkraine),
        }
      : item.SupplyOrderUkraineItem,
  }
}

function normalizeProductIncomePackingList(
  packingList?: ProductIncomePackingList | null,
): ProductIncomePackingList | null | undefined {
  if (!packingList) {
    return packingList
  }

  const invoice = packingList.SupplyInvoice
  const order = invoice?.SupplyOrder

  return {
    ...packingList,
    SupplyInvoice: invoice
      ? {
          ...invoice,
          SupplyOrder: order
            ? {
                ...order,
                SupplyOrderNumber: normalizeNumberObject(order.SupplyOrderNumber),
              }
            : order,
        }
      : invoice,
  }
}

function normalizeSupplyOrderUkraineNumber<T extends { InvNumber?: string; Number?: string } | null | undefined>(
  order: T,
): T {
  if (!order) {
    return order
  }

  return {
    ...order,
    Number: normalizeDisplayNumber(order.Number) || normalizeDisplayNumber(order.InvNumber),
  }
}

function normalizeNumberObject<T extends { Number?: string | null } | null | undefined>(value: T): T {
  if (!value) {
    return value
  }

  return {
    ...value,
    Number: normalizeDisplayNumber(value.Number),
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

function normalizeExportDocument(result: unknown): ProductIncomeDocumentsExportDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL:
      readString(payload.DocumentURL)
      || readString(payload.XlsxDocument)
      || readString(payload.URL)
      || readString(payload.url),
    PdfDocumentURL: readString(payload.PdfDocumentURL) || readString(payload.PdfDocument),
  }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readNumber(value: unknown, fallback?: number): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value)

    if (Number.isFinite(parsedValue)) {
      return parsedValue
    }
  }

  return fallback
}
