import { apiRequest } from '../../../shared/api/apiClient'
import type { Client } from '../types'

export async function getNewEcommerceClients(): Promise<Client[]> {
  const result = await apiRequest<unknown>('/clients/all/ecommerce')

  return normalizeClients(result)
}

function normalizeClients(result: unknown): Client[] {
  if (Array.isArray(result)) {
    return result as Client[]
  }

  if (result && typeof result === 'object' && 'Items' in result && Array.isArray(result.Items)) {
    return result.Items as Client[]
  }

  return []
}
