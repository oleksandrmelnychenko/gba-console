import { apiRequest } from '../../../shared/api/apiClient'
import type {
  Sad,
  SadClient,
  SadClientAgreement,
  SadOrganization,
  SadOrganizationClient,
  SadPalletType,
  SadPrintDocument,
  SadProductSpecification,
  SadSearchParams,
  SadSpecificationParseConfiguration,
  SadStatham,
} from '../types'

export async function getSads(params: SadSearchParams): Promise<Sad[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/all/filtered', {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      to: params.to,
    },
  })

  return normalizeArray<Sad>(result).map(ensureSad)
}

export async function getSad(netId: string): Promise<Sad | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/get', {
    query: {
      netId,
    },
  })

  return normalizeItem<Sad>(result, ensureSad)
}

export async function getSadWithSpecifications(netId: string): Promise<Sad | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/specification/products/get', {
    query: {
      netId,
    },
  })

  return normalizeItem<Sad>(result, ensureSad)
}

export async function updateSad(sad: Sad): Promise<Sad | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/update', {
    method: 'POST',
    body: sad,
  })

  return normalizeItem<Sad>(result, ensureSad)
}

export async function updateSaleSad(sad: Sad): Promise<Sad | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/update/sale', {
    method: 'POST',
    body: sad,
  })

  return normalizeItem<Sad>(result, ensureSad)
}

export async function deleteSad(netId: string): Promise<void> {
  await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function uploadSadDocuments(netId: string, files: File[]): Promise<Sad | null> {
  const formData = new FormData()

  files.forEach((file) => formData.append('files', file))

  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/documents/upload', {
    method: 'POST',
    query: {
      netId,
    },
    body: formData,
  })

  return normalizeItem<Sad>(result, ensureSad)
}

export async function deleteSadDocument(netId: string): Promise<void> {
  await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/documents/remove', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function getSadDocuments(netId: string): Promise<SadPrintDocument | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/documents/export', {
    query: {
      netId,
    },
  })

  return normalizeItem<SadPrintDocument>(result)
}

export async function getOrganizations(): Promise<SadOrganization[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return normalizeArray<SadOrganization>(result)
}

export async function searchClients(value: string): Promise<SadClient[]> {
  const result = await apiRequest<unknown>('/clients/search/all', {
    query: {
      value,
    },
  })

  return normalizeArray<SadClient>(result)
}

export async function getClientAgreements(netId: string): Promise<SadClientAgreement[]> {
  const result = await apiRequest<unknown>('/agreements/client/all', {
    query: {
      netId,
    },
  })

  return normalizeArray<SadClientAgreement>(result)
}

export async function searchOrganizationClients(value: string): Promise<SadOrganizationClient[]> {
  const result = await apiRequest<unknown>('/clients/organizations/all/search', {
    query: {
      value,
    },
  })

  return normalizeArray<SadOrganizationClient>(result).map(ensureOrganizationClient)
}

export async function searchStathams(value: string): Promise<SadStatham[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/carriers/statham/all/search', {
    query: {
      value,
    },
  })

  return normalizeArray<SadStatham>(result).map(ensureStatham)
}

export async function getSadPalletTypes(): Promise<SadPalletType[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/pallet/types/all')

  return normalizeArray<SadPalletType>(result)
}

export async function updateProductSpecification(
  sadNetId: string,
  specification: Partial<SadProductSpecification>,
): Promise<SadProductSpecification | null> {
  const result = await apiRequest<unknown>('/specifications/update', {
    method: 'POST',
    query: {
      sadNetId,
    },
    body: specification,
  })

  return normalizeItem<SadProductSpecification>(result)
}

export async function uploadProductSpecificationForSad(
  sadNetId: string,
  file: File,
  parseConfiguration: Record<keyof SadSpecificationParseConfiguration, number>,
): Promise<void> {
  const formData = new FormData()

  formData.append('file', file)
  formData.append('parseConfiguration', JSON.stringify(parseConfiguration))

  await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/specification/upload', {
    method: 'POST',
    query: {
      sadNetId,
    },
    body: formData,
  })
}

function normalizeArray<TItem>(result: unknown): TItem[] {
  const parsedResult = parseJsonPayload(result)

  if (Array.isArray(parsedResult)) {
    return parsedResult as TItem[]
  }

  if (!parsedResult || typeof parsedResult !== 'object') {
    return []
  }

  const payload = parsedResult as Record<string, unknown>
  const items = payload.Body ?? payload.Items ?? payload.Data ?? payload.Collection ?? payload.items ?? payload.data

  if (Array.isArray(items)) {
    return items as TItem[]
  }

  return []
}

function normalizeItem<TItem>(result: unknown, ensure?: (item: TItem) => TItem): TItem | null {
  const parsedResult = parseJsonPayload(result)
  const item = parsedResult && typeof parsedResult === 'object' && 'Body' in parsedResult
    ? (parsedResult as { Body?: unknown }).Body
    : parsedResult

  if (item && typeof item === 'object') {
    return ensure ? ensure(item as TItem) : item as TItem
  }

  return null
}

function parseJsonPayload(result: unknown): unknown {
  if (typeof result !== 'string') {
    return result
  }

  try {
    return JSON.parse(result) as unknown
  } catch {
    return result
  }
}

function ensureSad(sad: Sad): Sad {
  return {
    ...sad,
    SadDocuments: Array.isArray(sad.SadDocuments) ? sad.SadDocuments : [],
    SadItems: Array.isArray(sad.SadItems) ? sad.SadItems : [],
    SadPallets: Array.isArray(sad.SadPallets)
      ? sad.SadPallets.map((pallet) => ({
          ...pallet,
          SadPalletItems: Array.isArray(pallet.SadPalletItems) ? pallet.SadPalletItems : [],
        }))
      : [],
    Sales: Array.isArray(sad.Sales) ? sad.Sales : [],
  }
}

function ensureOrganizationClient(client: SadOrganizationClient): SadOrganizationClient {
  return {
    ...client,
    OrganizationClientAgreements: Array.isArray(client.OrganizationClientAgreements)
      ? client.OrganizationClientAgreements
      : [],
  }
}

function ensureStatham(statham: SadStatham): SadStatham {
  return {
    ...statham,
    StathamCars: Array.isArray(statham.StathamCars) ? statham.StathamCars : [],
  }
}

