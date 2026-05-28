import { apiRequest } from '../../../shared/api/apiClient'
import type { Currency, OrganizationClient } from '../types'

export async function getOrganizationClients(value?: string): Promise<OrganizationClient[]> {
  const normalizedValue = value?.trim()
  const result = await apiRequest<unknown>(
    normalizedValue ? '/clients/organizations/all/search' : '/clients/organizations/all',
    normalizedValue
      ? {
          query: {
            value: normalizedValue,
          },
        }
      : undefined,
  )

  return normalizeOrganizationClients(result)
}

export async function getOrganizationClient(netId: string): Promise<OrganizationClient | null> {
  const result = await apiRequest<unknown>('/clients/organizations/get', {
    query: {
      netId,
    },
  })

  return normalizeOrganizationClient(result)
}

export async function createOrganizationClient(client: OrganizationClient): Promise<OrganizationClient | null> {
  const result = await apiRequest<unknown>('/clients/organizations/new', {
    method: 'POST',
    body: client,
  })

  return normalizeOrganizationClient(result)
}

export async function updateOrganizationClient(client: OrganizationClient): Promise<OrganizationClient | null> {
  const result = await apiRequest<unknown>('/clients/organizations/update', {
    method: 'POST',
    body: client,
  })

  return normalizeOrganizationClient(result)
}

export async function deleteOrganizationClient(netId: string): Promise<void> {
  await apiRequest<unknown>('/clients/organizations/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function getCurrencies(): Promise<Currency[]> {
  const result = await apiRequest<unknown>('/currencies/all')

  return normalizeCurrencies(result)
}

function normalizeOrganizationClients(result: unknown): OrganizationClient[] {
  if (Array.isArray(result)) {
    return result.map(ensureOrganizationClientAgreements)
  }

  if (result && typeof result === 'object' && 'Items' in result && Array.isArray(result.Items)) {
    return result.Items.map(ensureOrganizationClientAgreements)
  }

  return []
}

function normalizeOrganizationClient(result: unknown): OrganizationClient | null {
  if (result && typeof result === 'object') {
    return ensureOrganizationClientAgreements(result as OrganizationClient)
  }

  return null
}

function normalizeCurrencies(result: unknown): Currency[] {
  if (Array.isArray(result)) {
    return result as Currency[]
  }

  if (result && typeof result === 'object' && 'Items' in result && Array.isArray(result.Items)) {
    return result.Items as Currency[]
  }

  return []
}

function ensureOrganizationClientAgreements(client: OrganizationClient): OrganizationClient {
  return {
    ...client,
    OrganizationClientAgreements: Array.isArray(client.OrganizationClientAgreements)
      ? client.OrganizationClientAgreements
      : [],
  }
}
