import { apiRequest } from '../../../shared/api/apiClient'
import { hasExportDocumentUrl, normalizeExportDocument } from '../../../shared/documents/exportDocument'
import { getAllProductGroups, getRootProductGroups } from '../../product-groups/api/productGroupsApi'
import type { ProductGroup } from '../../product-groups/types'
import { updateClient } from './clientFormApi'
import type {
  AgreementUpsert,
  Client,
  ClientAgreement,
  ClientPrintDocument,
  ClientUpsertResult,
  ProductGroupDiscount,
} from '../types'

const AgreementDownloadDocumentType = {
  Agreement: 0,
  WarrantyConditions: 1,
} as const

export type AgreementDownloadDocumentTypeValue =
  (typeof AgreementDownloadDocumentType)[keyof typeof AgreementDownloadDocumentType]

export async function getClientAgreements(netId: string, signal?: AbortSignal): Promise<ClientAgreement[]> {
  const result = await apiRequest<unknown>('/agreements/client/all', {
    query: {
      netId,
      includeDebts: false,
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
    : await getAllProductGroups()

  return mergeProductGroupDiscounts(productGroups, productGroupDiscounts)
}

export function mergeProductGroupDiscounts(
  productGroups: ProductGroup[],
  productGroupDiscounts: ProductGroupDiscount[] = [],
): ProductGroupDiscount[] {
  const existing = buildDiscountsByProductGroupId(productGroupDiscounts)

  return productGroups.map((productGroup) => {
    return buildProductGroupDiscount(productGroup, existing, undefined, new Set())
  })
}

function buildDiscountsByProductGroupId(productGroupDiscounts: ProductGroupDiscount[]): Map<number, ProductGroupDiscount> {
  const existing = new Map<number, ProductGroupDiscount>()

  function visit(discounts: ProductGroupDiscount[]) {
    discounts.forEach((discount) => {
      const productGroupId = getDiscountProductGroupId(discount)

      if (typeof productGroupId === 'number') {
        existing.set(productGroupId, discount)
      }

      if (Array.isArray(discount.SubProductGroupDiscounts)) {
        visit(discount.SubProductGroupDiscounts)
      }
    })
  }

  visit(productGroupDiscounts)

  return existing
}

function buildProductGroupDiscount(
  productGroup: ProductGroup,
  existing: Map<number, ProductGroupDiscount>,
  parentDiscount: ProductGroupDiscount | undefined,
  visitedProductGroupIds: Set<number>,
): ProductGroupDiscount {
  const productGroupId = productGroup.Id
  const matched = typeof productGroupId === 'number' ? existing.get(productGroupId) : undefined
  const nextVisitedIds = new Set(visitedProductGroupIds)

  if (typeof productGroupId === 'number') {
    nextVisitedIds.add(productGroupId)
  }

  const subProductGroups = getSubProductGroups(productGroup).filter((subProductGroup) => {
    return typeof subProductGroup.Id !== 'number' || !nextVisitedIds.has(subProductGroup.Id)
  })

  const baseDiscount: ProductGroupDiscount = {
    ...(matched || {}),
    ClientAgreementId: matched?.ClientAgreementId ?? parentDiscount?.ClientAgreementId,
    DiscountRate: matched?.DiscountRate ?? 0,
    IsActive: matched?.IsActive ?? true,
    ParentProductGroupDiscountId: parentDiscount?.Id ?? matched?.ParentProductGroupDiscountId,
    ProductGroup: productGroup,
    ProductGroupId: productGroupId ?? matched?.ProductGroupId,
  }

  const matchedSubDiscounts = Array.isArray(matched?.SubProductGroupDiscounts)
    ? matched.SubProductGroupDiscounts
    : []

  return {
    ...baseDiscount,
    SubProductGroupDiscounts: subProductGroups.length > 0
      ? subProductGroups.map((subProductGroup) =>
          buildProductGroupDiscount(subProductGroup, existing, baseDiscount, nextVisitedIds),
        )
      : matchedSubDiscounts,
  }
}

function getDiscountProductGroupId(discount: ProductGroupDiscount): number | undefined {
  if (typeof discount.ProductGroupId === 'number') {
    return discount.ProductGroupId
  }

  const productGroup = discount.ProductGroup as { Id?: unknown } | undefined

  return typeof productGroup?.Id === 'number' ? productGroup.Id : undefined
}

function getSubProductGroups(productGroup: ProductGroup): ProductGroup[] {
  return (productGroup.SubProductGroups || []).reduce<ProductGroup[]>((subProductGroups, productSubGroup) => {
    if (productSubGroup.SubProductGroup) {
      subProductGroups.push(productSubGroup.SubProductGroup)
    }

    return subProductGroups
  }, [])
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
  const document = normalizeExportDocument(result)

  return hasExportDocumentUrl(document) ? document : null
}
