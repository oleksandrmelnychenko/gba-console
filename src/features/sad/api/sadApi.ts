import { apiRequest } from '../../../shared/api/apiClient'
import { toDateTimeQuery } from '../../../shared/date/dateTime'
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
  SadSupplyOrderUkraineCartItem,
} from '../types'
import type { SupplyOrderUkraine } from '../../supply-ukraine-orders/types'
import type { IncomePaymentOrder } from '../../income-cashflows/types'

export type SadAdvancePaymentPayload = {
  Amount?: number
  ClientAgreement?: unknown
  Comment?: string
  FromDate?: string
  Organization?: unknown
  VatAmount?: number
  VatPercent?: number
}

export async function getSads(params: SadSearchParams): Promise<Sad[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/all/filtered', {
    query: {
      from: toDateTimeQuery(params.from, 'start'),
      limit: params.limit,
      offset: params.offset,
      to: toDateTimeQuery(params.to, 'end'),
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

export async function getAllUkraineCartItemsForSad(): Promise<SadSupplyOrderUkraineCartItem[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/cart/items/all')

  return normalizeArray<SadSupplyOrderUkraineCartItem>(result)
    .filter((item) => (item.ReservedQty || 0) > 0)
    .sort((first, second) => (
      (second.ReservedQty || 0) - (first.ReservedQty || 0)
      || (second.AvailableQty || 0) - (first.AvailableQty || 0)
    ))
}

export async function createSupplyOrderFromSad(
  sadNetId: string,
  order: Partial<SupplyOrderUkraine>,
): Promise<SupplyOrderUkraine | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/new/packlist/sad', {
    method: 'POST',
    query: {
      sadNetId,
    },
    body: order,
  })

  return normalizeItem<SupplyOrderUkraine>(result)
}

export async function createIncomePaymentFromSad(
  sadNetId: string,
  paymentIncome: IncomePaymentOrder,
): Promise<IncomePaymentOrder | null> {
  const result = await apiRequest<unknown>('/payments/orders/income/new/sad', {
    method: 'POST',
    query: {
      sadNetId,
    },
    body: paymentIncome,
  })

  return normalizeItem<IncomePaymentOrder>(result)
}

export async function createAdvancePaymentFromSad(
  sadNetId: string,
  advancePayment: SadAdvancePaymentPayload,
): Promise<SadAdvancePaymentPayload | null> {
  const result = await apiRequest<unknown>('/payments/advance/new', {
    method: 'POST',
    query: {
      sadNetId,
    },
    body: advancePayment,
  })

  return normalizeItem<SadAdvancePaymentPayload>(result)
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
