import { apiRequest } from '../../../shared/api/apiClient'
import type {
  Product,
  ProductGroup,
  ProductGroupsWithTotal,
  ProductProductGroup,
  ProductProductGroupsWithTotal,
  ProductSubGroup,
  ProductSubGroupsWithTotal,
} from '../types'

type ListKey = 'ProductGroups' | 'ProductProductGroups' | 'ProductSubGroups'

export async function getProductGroups(value?: string): Promise<ProductGroupsWithTotal> {
  const result = await apiRequest<unknown>('/products/groups/filtered/get', {
    query: {
      value: value?.trim() || '',
    },
  })
  const normalized = normalizeList<ProductGroup>(result, 'ProductGroups')

  return {
    ProductGroups: normalized.items.map(ensureProductGroup),
    TotalFilteredQty: normalized.totalFilteredQty,
    TotalQty: normalized.totalQty,
  }
}

export async function getProductGroupWithRoot(netId: string): Promise<ProductGroup | null> {
  const result = await apiRequest<unknown>('/products/groups/with/root/get', {
    query: {
      netId,
    },
  })

  return normalizeProductGroup(result)
}

export async function getRootProductGroups(netId?: string): Promise<ProductGroup[]> {
  const result = await apiRequest<unknown>('/products/groups/root/groups/get', {
    query: {
      netId: netId || undefined,
    },
  })

  return normalizeArray<ProductGroup>(result).map(ensureProductGroup)
}

export async function createProductGroup(productGroup: ProductGroup): Promise<ProductGroup | null> {
  const result = await apiRequest<unknown>('/products/groups/new', {
    method: 'POST',
    body: productGroup,
  })

  return normalizeProductGroup(result)
}

export async function updateProductGroup(productGroup: ProductGroup): Promise<ProductGroup | null> {
  const result = await apiRequest<unknown>('/products/groups/with/content/update', {
    method: 'POST',
    body: productGroup,
  })

  return normalizeProductGroup(result)
}

export async function deleteProductGroup(netId: string): Promise<void> {
  await apiRequest<unknown>('/products/groups/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function getProductSubGroups(params: {
  limit: number
  netId: string
  offset: number
  value?: string
}): Promise<ProductSubGroupsWithTotal> {
  const result = await apiRequest<unknown>('/products/groups/filtered/sub/groups/get', {
    query: {
      limit: params.limit,
      netId: params.netId,
      offset: params.offset,
      value: params.value?.trim() || '',
    },
  })
  const normalized = normalizeList<ProductSubGroup>(result, 'ProductSubGroups')

  return {
    ProductSubGroups: normalized.items.map(ensureProductSubGroup),
    TotalFilteredQty: normalized.totalFilteredQty,
    TotalQty: normalized.totalQty,
  }
}

export async function getRedirectedProductByNetId(netId: string): Promise<Product | null> {
  const result = await apiRequest<unknown>('/products/get', {
    query: {
      netId,
    },
  })

  if (result && typeof result === 'object') {
    return result as Product
  }

  return null
}

export async function getProductGroupProducts(params: {
  limit: number
  netId: string
  offset: number
  value?: string
}): Promise<ProductProductGroupsWithTotal> {
  const result = await apiRequest<unknown>('/products/groups/filtered/products/get', {
    query: {
      limit: params.limit,
      netId: params.netId,
      offset: params.offset,
      value: params.value?.trim() || '',
    },
  })
  const normalized = normalizeList<ProductProductGroup>(result, 'ProductProductGroups')

  return {
    ProductProductGroups: normalized.items.map(ensureProductProductGroup),
    TotalFilteredQty: normalized.totalFilteredQty,
    TotalQty: normalized.totalQty,
  }
}

function normalizeProductGroup(result: unknown): ProductGroup | null {
  if (result && typeof result === 'object') {
    return ensureProductGroup(result as ProductGroup)
  }

  return null
}

function normalizeArray<TItem>(result: unknown): TItem[] {
  if (Array.isArray(result)) {
    return result as TItem[]
  }

  if (result && typeof result === 'object' && 'Items' in result && Array.isArray(result.Items)) {
    return result.Items as TItem[]
  }

  return []
}

function normalizeList<TItem>(
  result: unknown,
  key: ListKey,
): { items: TItem[]; totalFilteredQty: number; totalQty: number } {
  if (Array.isArray(result)) {
    return {
      items: result as TItem[],
      totalFilteredQty: result.length,
      totalQty: result.length,
    }
  }

  if (!result || typeof result !== 'object') {
    return {
      items: [],
      totalFilteredQty: 0,
      totalQty: 0,
    }
  }

  const payload = result as Record<string, unknown>
  const items = Array.isArray(payload[key])
    ? (payload[key] as TItem[])
    : Array.isArray(payload.Items)
      ? (payload.Items as TItem[])
      : []

  return {
    items,
    totalFilteredQty: readTotal(payload.TotalFilteredQty, items.length),
    totalQty: readTotal(payload.TotalQty, items.length),
  }
}

function readTotal(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function ensureProductGroup(productGroup: ProductGroup): ProductGroup {
  return {
    ...productGroup,
    ProductProductGroups: Array.isArray(productGroup.ProductProductGroups)
      ? productGroup.ProductProductGroups
      : [],
    RootProductGroups: Array.isArray(productGroup.RootProductGroups) ? productGroup.RootProductGroups : [],
    SubProductGroups: Array.isArray(productGroup.SubProductGroups) ? productGroup.SubProductGroups : [],
  }
}

function ensureProductSubGroup(productSubGroup: ProductSubGroup): ProductSubGroup {
  return {
    ...productSubGroup,
    RootProductGroup: productSubGroup.RootProductGroup
      ? ensureProductGroup(productSubGroup.RootProductGroup)
      : productSubGroup.RootProductGroup,
    SubProductGroup: productSubGroup.SubProductGroup
      ? ensureProductGroup(productSubGroup.SubProductGroup)
      : productSubGroup.SubProductGroup,
  }
}

function ensureProductProductGroup(productProductGroup: ProductProductGroup): ProductProductGroup {
  return {
    ...productProductGroup,
    ProductGroup: productProductGroup.ProductGroup
      ? ensureProductGroup(productProductGroup.ProductGroup)
      : productProductGroup.ProductGroup,
  }
}
