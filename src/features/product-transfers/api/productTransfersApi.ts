import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ProductTransfer,
  ProductTransferCreateFromFilePayload,
  ProductTransfersSearchParams,
  ProductTransferStorage,
} from '../types'

export async function getProductTransfers(params: ProductTransfersSearchParams): Promise<ProductTransfer[]> {
  const result = await apiRequest<unknown>('/products/transfers/all/filtered', {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      to: params.to,
    },
  })

  return normalizeProductTransfers(result)
}

export async function getProductTransferByNetId(netId: string): Promise<ProductTransfer | null> {
  const result = await apiRequest<unknown>('/products/transfers/get', {
    query: {
      netId,
    },
  })

  return normalizeProductTransfer(result)
}

export async function getProductTransferStorages(): Promise<ProductTransferStorage[]> {
  const result = await apiRequest<unknown>('/storages/get/all')

  return normalizeStorages(result)
}

export async function addProductTransferFromFile(payload: ProductTransferCreateFromFilePayload): Promise<string[]> {
  const formData = new FormData()
  formData.append('parseConfiguration', JSON.stringify(payload.parseConfiguration))
  formData.append('productTransfer', JSON.stringify(payload.productTransfer))
  formData.append('file', payload.file)

  const result = await apiRequest<unknown>('/products/transfers/add/file', {
    method: 'POST',
    body: formData,
  })

  return normalizeMessages(result)
}

function normalizeProductTransfers(result: unknown): ProductTransfer[] {
  if (Array.isArray(result)) {
    return result.map(ensureProductTransfer)
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>
  const items = Array.isArray(payload.Items)
    ? payload.Items
    : Array.isArray(payload.ProductTransfers)
      ? payload.ProductTransfers
      : Array.isArray(payload.Data)
        ? payload.Data
        : []

  return (items as ProductTransfer[]).map(ensureProductTransfer)
}

function normalizeProductTransfer(result: unknown): ProductTransfer | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return ensureProductTransfer(result as ProductTransfer)
}

function normalizeStorages(result: unknown): ProductTransferStorage[] {
  if (Array.isArray(result)) {
    return result as ProductTransferStorage[]
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  if (Array.isArray(payload.Items)) {
    return payload.Items as ProductTransferStorage[]
  }

  if (Array.isArray(payload.Storages)) {
    return payload.Storages as ProductTransferStorage[]
  }

  if (Array.isArray(payload.Collection)) {
    return payload.Collection as ProductTransferStorage[]
  }

  return []
}

function normalizeMessages(result: unknown): string[] {
  if (Array.isArray(result)) {
    return result.reduce<string[]>((items, item) => {
      const value = String(item)

      if (value) {
        items.push(value)
      }

      return items
    }, [])
  }

  if (typeof result === 'string') {
    return result.trim() ? [result] : []
  }

  return []
}

function ensureProductTransfer(productTransfer: ProductTransfer): ProductTransfer {
  return {
    ...productTransfer,
    ProductTransferItems: Array.isArray(productTransfer.ProductTransferItems)
      ? productTransfer.ProductTransferItems.map((item) => ({
          ...item,
          ProductLocations: Array.isArray(item.ProductLocations) ? item.ProductLocations : [],
        }))
      : [],
  }
}
