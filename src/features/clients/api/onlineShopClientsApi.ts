import { apiRequest } from '../../../shared/api/apiClient'
import type {
  IncompleteSale,
  IncompleteSalesSearchParams,
  RetailCartItem,
  RetailClient,
  RetailSale,
} from '../onlineShopTypes'

export async function getRetailClients(): Promise<RetailClient[]> {
  const result = await apiRequest<unknown>('/retail/clients/all')

  return normalizeCollection<RetailClient>(result)
}

export async function searchRetailClients(value: string): Promise<RetailClient[]> {
  const result = await apiRequest<unknown>('/retail/clients/sales/filtered', {
    query: {
      value: value.trim(),
    },
  })

  return normalizeCollection<RetailClient>(result)
}

export async function getRetailClientCart(netId: string): Promise<RetailCartItem[]> {
  const result = await apiRequest<unknown>('/retail/clients/cart', {
    query: {
      netId,
    },
  })

  return normalizeCollection<RetailCartItem>(result)
}

export async function getRetailClientSales(netId: string): Promise<RetailSale[]> {
  const result = await apiRequest<unknown>('/retail/clients/sales', {
    query: {
      netId,
    },
  })

  return normalizeCollection<RetailSale>(result)
}

export async function getIncompleteSaleByNetUid(netId: string): Promise<IncompleteSale | null> {
  const result = await apiRequest<unknown>('/sales/misplaced/get', {
    query: {
      netId,
    },
  })

  return normalizeObject<IncompleteSale>(result)
}

export async function getIncompleteSales(params: IncompleteSalesSearchParams = {}): Promise<IncompleteSale[]> {
  const result = await apiRequest<unknown>('/sales/misplaced/get/all', {
    query: {
      number: params.number?.trim() || undefined,
      from: params.from,
      to: toEndOfDay(params.to),
      isAccepted: params.isAccepted,
    },
  })

  return normalizeCollection<IncompleteSale>(result)
}

export async function updateIncompleteSale(incompleteSale: IncompleteSale): Promise<IncompleteSale[]> {
  const result = await apiRequest<unknown>('/sales/misplaced/update', {
    method: 'POST',
    body: incompleteSale,
  })

  return normalizeCollection<IncompleteSale>(result)
}

function toEndOfDay(value?: string): string | undefined {
  if (!value) {
    return value
  }

  return value.includes('T') ? value : `${value}T23:59:59`
}

function normalizeCollection<T>(result: unknown): T[] {
  const parsedResult = parseJsonPayload(result)

  if (Array.isArray(parsedResult)) {
    return parsedResult as T[]
  }

  if (parsedResult && typeof parsedResult === 'object') {
    const { Items, items, Data, data } = parsedResult as {
      Data?: unknown
      Items?: unknown
      data?: unknown
      items?: unknown
    }

    if (Array.isArray(Items)) {
      return Items as T[]
    }

    if (Array.isArray(items)) {
      return items as T[]
    }

    if (Array.isArray(Data)) {
      return Data as T[]
    }

    if (Array.isArray(data)) {
      return data as T[]
    }
  }

  return []
}

function normalizeObject<T>(result: unknown): T | null {
  const parsedResult = parseJsonPayload(result)

  return parsedResult && typeof parsedResult === 'object' && !Array.isArray(parsedResult) ? (parsedResult as T) : null
}

function parseJsonPayload(result: unknown): unknown {
  if (typeof result !== 'string') {
    return result
  }

  const normalized = result.trim()

  if (!normalized) {
    return null
  }

  try {
    return JSON.parse(normalized) as unknown
  } catch {
    return null
  }
}
