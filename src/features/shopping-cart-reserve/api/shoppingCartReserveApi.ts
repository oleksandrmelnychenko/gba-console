import { apiRequest } from '../../../shared/api/apiClient'
import type { ShoppingCartReserveItem } from '../types'

export async function getShoppingCartReserves(): Promise<ShoppingCartReserveItem[]> {
  const result = await apiRequest<unknown>('/sales/carts/all')

  return normalizeArray(result) as ShoppingCartReserveItem[]
}

function normalizeArray(result: unknown): unknown[] {
  const parsed = typeof result === 'string' ? safeParse(result) : result

  if (Array.isArray(parsed)) {
    return parsed
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>

    for (const key of ['Items', 'Carts', 'ClientShoppingCarts', 'Data', 'Collection']) {
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
