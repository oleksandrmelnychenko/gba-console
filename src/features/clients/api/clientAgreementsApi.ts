import { apiRequest } from '../../../shared/api/apiClient'
import { getProductGroups, getRootProductGroups } from '../../product-groups/api/productGroupsApi'
import { updateClient } from './clientFormApi'
import type {
  AgreementUpsert,
  Client,
  ClientAgreement,
  ClientPrintDocument,
  ClientUpsertResult,
  ProductGroupDiscount,
} from '../types'

export const AgreementDownloadDocumentType = {
  Agreement: 0,
  WarrantyConditions: 1,
} as const

export type AgreementDownloadDocumentTypeValue =
  (typeof AgreementDownloadDocumentType)[keyof typeof AgreementDownloadDocumentType]

export async function getClientAgreements(netId: string, signal?: AbortSignal): Promise<ClientAgreement[]> {
  const result = await apiRequest<unknown>('/agreements/client/all', {
    query: {
      netId,
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeAgreementList(result)
}

export async function getRetailClientAgreements(netId: string, signal?: AbortSignal): Promise<ClientAgreement[]> {
  const result = await apiRequest<unknown>('/agreements/retail/client/all', {
    query: {
      netId,
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeAgreementList(result)
}

export async function getClientAgreementsWithDebt(netId: string, signal?: AbortSignal): Promise<ClientAgreement[]> {
  const result = await apiRequest<unknown>('/agreements/client/all/grouped', {
    query: {
      netId,
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeAgreementList(result)
}

export async function getClientAgreementsWithSubClients(
  netId: string,
  signal?: AbortSignal,
): Promise<ClientAgreement[]> {
  const result = await apiRequest<unknown>('/clients/clientagreements/all/sub/client', {
    query: {
      netId,
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeAgreementList(result)
}

export async function getSupplyOrganizationAgreements(id: string, signal?: AbortSignal): Promise<ClientAgreement[]> {
  const result = await apiRequest<unknown>('/supplies/organizations/agreements/by', {
    query: {
      id,
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeAgreementList(result)
}

export async function saveClientAgreement(client: Client, agreement: AgreementUpsert): Promise<ClientUpsertResult> {
  const clientAgreements = upsertClientAgreement(client.ClientAgreements, agreement)

  return updateClient({
    ...client,
    ClientAgreements: clientAgreements,
  })
}

export async function deleteClientAgreement(client: Client, agreement: AgreementUpsert): Promise<ClientUpsertResult> {
  const clientAgreements = removeClientAgreement(client.ClientAgreements, agreement)

  return updateClient({
    ...client,
    ClientAgreements: clientAgreements,
  })
}

export async function exportAgreementDocument(
  netId: string,
  type: AgreementDownloadDocumentTypeValue = AgreementDownloadDocumentType.Agreement,
): Promise<ClientPrintDocument | null> {
  const result = await apiRequest<unknown>('/agreements/get/document', {
    query: {
      netId,
      type,
    },
  })

  return normalizeDocument(result)
}

export async function exportAgreementWarrantyConditions(netId: string): Promise<ClientPrintDocument | null> {
  return exportAgreementDocument(netId, AgreementDownloadDocumentType.WarrantyConditions)
}

export async function getAgreementProductGroupDiscounts(
  productGroupDiscounts: ProductGroupDiscount[] = [],
  rootNetId?: string,
): Promise<ProductGroupDiscount[]> {
  const productGroups = rootNetId
    ? await getRootProductGroups(rootNetId)
    : (await getProductGroups()).ProductGroups

  const existing = new Map<number, ProductGroupDiscount>()

  productGroupDiscounts.forEach((discount) => {
    if (typeof discount.ProductGroupId === 'number') {
      existing.set(discount.ProductGroupId, discount)
    }
  })

  return productGroups.map((productGroup) => {
    const matched = typeof productGroup.Id === 'number' ? existing.get(productGroup.Id) : undefined

    if (matched) {
      return {
        ...matched,
        ProductGroup: productGroup,
      }
    }

    return {
      ProductGroupId: productGroup.Id,
      ProductGroup: productGroup,
      IsActive: true,
      DiscountRate: 0,
      SubProductGroupDiscounts: [],
    }
  })
}

function upsertClientAgreement(
  clientAgreements: ClientAgreement[] | undefined,
  agreement: AgreementUpsert,
): ClientAgreement[] {
  const agreements = Array.isArray(clientAgreements) ? clientAgreements : []
  const index = agreements.findIndex((clientAgreement) => isSameAgreement(clientAgreement.Agreement, agreement))

  if (index === -1) {
    return [...agreements, { Agreement: agreement }]
  }

  return agreements.map((clientAgreement, currentIndex) =>
    currentIndex === index ? { ...clientAgreement, Agreement: agreement } : clientAgreement,
  )
}

function removeClientAgreement(
  clientAgreements: ClientAgreement[] | undefined,
  agreement: AgreementUpsert,
): ClientAgreement[] {
  const agreements = Array.isArray(clientAgreements) ? clientAgreements : []

  return agreements.filter((clientAgreement) => !isSameAgreement(clientAgreement.Agreement, agreement))
}

function isSameAgreement(left: AgreementUpsert | undefined, right: AgreementUpsert): boolean {
  if (!left) {
    return false
  }

  if (left.NetUid && right.NetUid) {
    return left.NetUid === right.NetUid
  }

  if (typeof left.Id === 'number' && typeof right.Id === 'number' && left.Id > 0 && right.Id > 0) {
    return left.Id === right.Id
  }

  if (typeof left.TempId === 'number' && typeof right.TempId === 'number') {
    return left.TempId === right.TempId
  }

  return left === right
}

function normalizeAgreementList(result: unknown): ClientAgreement[] {
  if (Array.isArray(result)) {
    return result as ClientAgreement[]
  }

  if (result && typeof result === 'object') {
    const items = (result as { Items?: unknown }).Items

    if (Array.isArray(items)) {
      return items as ClientAgreement[]
    }
  }

  return []
}

function normalizeDocument(result: unknown): ClientPrintDocument | null {
  if (result && typeof result === 'object') {
    return result as ClientPrintDocument
  }

  return null
}
