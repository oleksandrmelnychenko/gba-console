import { apiRequest } from '../../../shared/api/apiClient'
import type { SalesPredictionClientOption, SalesPredictionPoint, SalesPredictionProductOption } from '../types'

export async function getPredictionByClient(clientNetId: string): Promise<SalesPredictionPoint[]> {
  const result = await apiRequest<unknown>('/sales/prediction/get', {
    query: { clientNetId },
  })

  return readPredictionArray(result, 'ByClient')
}

export async function getPredictionByProduct(productNetId: string): Promise<SalesPredictionPoint[]> {
  const result = await apiRequest<unknown>('/sales/prediction/get', {
    query: { productNetId },
  })

  return readPredictionArray(result, 'ByProduct')
}

export async function getPredictionByClientAndProduct(
  clientNetId: string,
  productNetId: string,
): Promise<SalesPredictionPoint[]> {
  const result = await apiRequest<unknown>('/sales/prediction/get', {
    query: { clientNetId, productNetId },
  })

  return readPredictionArray(result, 'ByClientAndProduct')
}

export async function searchPredictionClients(searchValue: string): Promise<SalesPredictionClientOption[]> {
  const result = await apiRequest<unknown>('/clients/search/all/sales/', {
    query: { searchValue: searchValue.trim() },
  })

  return normalizeArray(result) as SalesPredictionClientOption[]
}

export async function searchPredictionProducts(searchValue: string): Promise<SalesPredictionProductOption[]> {
  const result = await apiRequest<unknown>('/products/search/vendorcodeandsales', {
    query: { limit: 20, offset: 0, searchValue: searchValue.trim() },
  })

  return normalizeArray(result) as SalesPredictionProductOption[]
}

function readPredictionArray(result: unknown, key: string): SalesPredictionPoint[] {
  const parsed = typeof result === 'string' ? safeParse(result) : result

  if (parsed && typeof parsed === 'object') {
    const value = (parsed as Record<string, unknown>)[key]

    if (Array.isArray(value)) {
      return value as SalesPredictionPoint[]
    }
  }

  return []
}

function normalizeArray(result: unknown): unknown[] {
  const parsed = typeof result === 'string' ? safeParse(result) : result

  if (Array.isArray(parsed)) {
    return parsed
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>

    for (const key of ['Items', 'Clients', 'Products', 'Data', 'Collection']) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[]
      }
    }
  }

  return []
}

function safeParse(value: string): unknown {
  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  try {
    return JSON.parse(normalized) as unknown
  } catch {
    return null
  }
}
