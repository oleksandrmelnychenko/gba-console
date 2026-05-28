import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ProductCapitalization,
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

function normalizeProductCapitalizationsResponse(result: unknown): ProductCapitalizationsResponse {
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}
  const items = readArrayPayload(result, ['Items', 'ProductCapitalizations', 'Capitalizations', 'Data'])

  return {
    Items: items.map((item) => normalizeProductCapitalization(item) as ProductCapitalization),
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
      ? capitalization.ProductCapitalizationItems
      : [],
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
