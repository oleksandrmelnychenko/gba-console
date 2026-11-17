import { apiRequest } from '../../../shared/api/apiClient'
import type { Currency, OrganizationClient } from '../types'

export async function getOrganizationClients(value?: string): Promise<OrganizationClient[]> {
  const normalizedValue = value?.trim()
  const result = await apiRequest<unknown>(
    normalizedValue ? '/clients/organizations/registry/search' : '/clients/organizations/registry',
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
  const result = await apiRequest<unknown>('/clients/organizations/details', {
    query: {
      netId,
    },
  })

  return normalizeOrganizationClient(result)
}

/* Agreement «Дата» is a calendar date. The server converts the sent time from the
   user's zone to UTC and then keeps only the date, so midnight (or a bare
   "2026-11-17") became the previous day — and every re-save lost another day.
   Noon survives the conversion in any zone within ±12 h. */
export function toAgreementDatePayload(value: Date | string | undefined): Date | string | undefined {
  if (!value) {
    return value
  }

  if (typeof value === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value)
    return match ? `${match[1]}T12:00:00` : value
  }

  if (Number.isNaN(value.getTime())) {
    return value
  }

  const pad = (part: number) => String(part).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T12:00:00`
}

function prepareOrganizationClientPayload(client: OrganizationClient): OrganizationClient {
  if (!Array.isArray(client.OrganizationClientAgreements)) {
    return client
  }

  return {
    ...client,
    OrganizationClientAgreements: client.OrganizationClientAgreements.map((agreement) => ({
      ...agreement,
      FromDate: toAgreementDatePayload(agreement.FromDate),
    })),
  }
}

export async function createOrganizationClient(client: OrganizationClient): Promise<OrganizationClient | null> {
  const result = await apiRequest<unknown>('/clients/organizations/create', {
    method: 'POST',
    body: prepareOrganizationClientPayload(client),
  })

  return normalizeOrganizationClient(result)
}

export async function updateOrganizationClient(client: OrganizationClient): Promise<OrganizationClient | null> {
  const result = await apiRequest<unknown>('/clients/organizations/edit', {
    method: 'POST',
    body: prepareOrganizationClientPayload(client),
  })

  return normalizeOrganizationClient(result)
}

export async function deleteOrganizationClient(netId: string): Promise<void> {
  await apiRequest<unknown>('/clients/organizations/remove', {
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
