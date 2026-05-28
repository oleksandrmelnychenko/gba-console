import { apiRequest } from '../../../shared/api/apiClient'
import type { Client, ClientUpsertResult } from '../types'

export async function getClientById(netId: string): Promise<Client | null> {
  const result = await apiRequest<unknown>('/clients/get', {
    query: {
      netId,
    },
  })

  return normalizeClient(result)
}

export async function createClient(client: Client, parentId?: string | null): Promise<ClientUpsertResult> {
  const result = await apiRequest<unknown>('/clients/new', {
    method: 'POST',
    query: {
      parentId: parentId || undefined,
    },
    body: client,
  })

  return normalizeClient(result)
}

export async function updateClient(client: Client): Promise<ClientUpsertResult> {
  const result = await apiRequest<unknown>('/clients/update', {
    method: 'POST',
    body: client,
  })

  return normalizeClient(result)
}

export async function deleteClient(netId: string): Promise<void> {
  await apiRequest<unknown>('/clients/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

function normalizeClient(result: unknown): Client | null {
  if (result && typeof result === 'object') {
    return result as Client
  }

  return null
}
