import { apiRequest } from '../../../shared/api/apiClient'
import {
  getClientResourceOrganizations,
  getClientResourceStorages,
} from '../../client-resources/api/clientResourcesApi'
import type {
  ClientResourceOrganization,
  ClientResourceStorage,
} from '../../client-resources/types'
import type {
  ProductCapitalization,
  ProductCapitalizationCreatePayload,
  ProductCapitalizationItemsFromFile,
  ProductCapitalizationItem,
  ProductCapitalizationParseConfiguration,
  ProductCapitalizationSearchProduct,
  ProductCapitalizationsExportDocument,
  ProductCapitalizationsResponse,
  ProductCapitalizationsSearchParams,
} from '../types'

export async function getProductCapitalizations(
  params: ProductCapitalizationsSearchParams,
): Promise<ProductCapitalizationsResponse> {
  const result = await apiRequest<unknown>('/products/capitalizations/all/filtered', {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      to: params.to,
    },
  })

  return normalizeProductCapitalizationsResponse(result)
}

export async function getProductCapitalization(netId: string): Promise<ProductCapitalization | null> {
  const result = await apiRequest<unknown>('/products/capitalizations/get', {
    query: {
      netId,
    },
  })

  return normalizeProductCapitalization(result)
}

export async function exportProductCapitalization(netId: string): Promise<ProductCapitalizationsExportDocument> {
  const result = await apiRequest<unknown>('/products/capitalizations/document/export', {
    query: {
      netId,
    },
  })

  return normalizeExportDocument(result)
}

export async function createProductCapitalization(
  payload: ProductCapitalizationCreatePayload,
): Promise<ProductCapitalization | null> {
  const result = await apiRequest<unknown>('/products/capitalizations/new', {
    method: 'POST',
    body: payload,
  })

  return normalizeProductCapitalization(result)
}

export async function recordProductCapitalizationHistory(productCapitalization: ProductCapitalization): Promise<void> {
  await apiRequest<unknown>('/history/order/item/add/product/capitalization', {
    method: 'POST',
    body: productCapitalization,
  })
}

export async function searchProductsByVendorCode(
  value: string,
  limit = 20,
  offset = 0,
): Promise<ProductCapitalizationSearchProduct[]> {
  const result = await apiRequest<unknown>('/products/search/vendorcode', {
    query: {
      limit,
      offset,
      value: value.trim(),
    },
  })

  return readArrayPayload(result, ['Items', 'Products', 'Data']).map(
    (item) => item as ProductCapitalizationSearchProduct,
  )
}

export async function getProductCapitalizationOrganizations(): Promise<ClientResourceOrganization[]> {
  return getClientResourceOrganizations()
}

export async function getProductCapitalizationStoragesByOrganization(
  organizationNetId: string,
): Promise<ClientResourceStorage[]> {
  const result = await apiRequest<unknown>('/storages/get/all/filtered', {
    query: {
      organizationNetId,
      skipDefective: false,
    },
  })

  return readArrayPayload(result, ['Items', 'Storages', 'Data']).map((item) => item as ClientResourceStorage)
}

export async function getProductCapitalizationStorages(): Promise<ClientResourceStorage[]> {
  return getClientResourceStorages()
}

export async function parseProductCapitalizationItemsFromFile(
  file: File,
  parseConfiguration: ProductCapitalizationParseConfiguration,
): Promise<ProductCapitalizationItemsFromFile> {
  const formData = new FormData()

  formData.append('file', file)
  formData.append('configuration', JSON.stringify(parseConfiguration))

  const result = await apiRequest<unknown>('/products/capitalizations/get/items/file', {
    method: 'POST',
    body: formData,
  })

  return normalizeItemsFromFile(result)
}

function normalizeItemsFromFile(result: unknown): ProductCapitalizationItemsFromFile {
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}
  const items = readArrayPayload(result, ['Items', 'ProductCapitalizationItems', 'Data']).map(normalizeProductCapitalizationItem)
  const missingVendorCodes = Array.isArray(payload.MissingVendorCodes)
    ? (payload.MissingVendorCodes as unknown[]).map((code) => String(code))
    : []

  return {
    Items: items,
    MissingVendorCodes: missingVendorCodes,
  }
}

function normalizeProductCapitalizationsResponse(result: unknown): ProductCapitalizationsResponse {
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}
  const items = readArrayPayload(result, ['Items', 'ProductCapitalizations', 'Capitalizations', 'Data'])

  return {
    Items: items.map(normalizeProductCapitalization).filter((item): item is ProductCapitalization => Boolean(item)),
    Total: readNumber(payload.Total, items.length),
  }
}

function normalizeProductCapitalization(result: unknown): ProductCapitalization | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const capitalization = result as ProductCapitalization

  return {
    ...capitalization,
    ProductCapitalizationItems: Array.isArray(capitalization.ProductCapitalizationItems)
      ? capitalization.ProductCapitalizationItems.map(normalizeProductCapitalizationItem)
      : [],
  }
}

function normalizeProductCapitalizationItem(result: unknown): ProductCapitalizationItem {
  const item = (result && typeof result === 'object' ? result : {}) as ProductCapitalizationItem

  return {
    ...item,
    ProductId: item.ProductId || item.Product?.Id,
    ProductName: item.ProductName || item.Product?.Name,
    ProductVendorCode: item.ProductVendorCode || item.Product?.VendorCode,
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

function normalizeExportDocument(result: unknown): ProductCapitalizationsExportDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL: typeof payload.PdfDocumentURL === 'string' ? payload.PdfDocumentURL : '',
  }
}

function readNumber(value: unknown, fallback: number): number {
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
