import { apiRequest } from '../../../shared/api/apiClient'
import {
  executeAccountingMutation,
  type AccountingMutationOperationOptions,
} from '../../../shared/api/accountingMutationOperation'
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

const CREATE_SAD_INCOME_ENDPOINT = '/payments/orders/income/sad/create'

export async function getSads(params: SadSearchParams): Promise<Sad[]> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/page/registry', {
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
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/page/details', {
    query: {
      netId,
    },
  })

  return normalizeItem<Sad>(result, ensureSad)
}

export async function getSadWithSpecifications(netId: string): Promise<Sad | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/page/specification/details', {
    query: {
      netId,
    },
  })

  return normalizeItem<Sad>(result, ensureSad)
}

export async function updateSad(sad: Sad): Promise<Sad | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/page/edit', {
    method: 'POST',
    body: toSadEditRequest(sad),
  })

  return normalizeItem<Sad>(result, ensureSad)
}

export async function updateSaleSad(sad: Sad): Promise<Sad | null> {
  return updateSad(sad)
}

export async function sendSad(netId: string): Promise<Sad | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/page/send', {
    method: 'POST',
    query: { netId },
  })

  return normalizeItem<Sad>(result, ensureSad)
}

export async function updateSadPallets(sad: Sad): Promise<Sad | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/page/pallet/edit', {
    method: 'POST',
    body: {
      netUid: sad.NetUid,
      pallets: (sad.SadPallets || []).map((pallet) => ({
        id: pallet.Id || 0,
        sadPalletTypeId: pallet.SadPalletTypeId || pallet.SadPalletType?.Id || 0,
        number: pallet.Number || '',
        comment: pallet.Comment || '',
        items: (pallet.SadPalletItems || []).map((item) => ({
          id: item.Id || 0,
          sadItemId: item.SadItemId || item.SadItem?.Id || 0,
          qty: item.ChangedQty ?? item.Qty ?? 0,
        })),
      })),
    },
  })

  return normalizeItem<Sad>(result, ensureSad)
}

export async function deleteSad(netId: string): Promise<void> {
  await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/page/remove', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function uploadSadDocuments(netId: string, files: File[]): Promise<Sad | null> {
  const formData = new FormData()

  files.forEach((file) => formData.append('files', file))

  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/page/document/upload', {
    method: 'POST',
    query: {
      netId,
    },
    body: formData,
  })

  return normalizeItem<Sad>(result, ensureSad)
}

export async function deleteSadDocument(netId: string): Promise<void> {
  await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/page/document/remove', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function getSadDocuments(netId: string): Promise<SadPrintDocument | null> {
  const result = await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/page/document/export', {
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
  const result = await apiRequest<unknown>('/specifications/sad/update', {
    method: 'POST',
    query: {
      sadNetId,
    },
    body: {
      id: specification.Id || 0,
      productId: specification.ProductId || specification.Product?.Id || 0,
      specificationCode: specification.SpecificationCode || '',
      customsValue: specification.CustomsValue || 0,
      duty: specification.Duty || 0,
      vatValue: specification.VATValue || 0,
      dutyPercent: specification.DutyPercent || 0,
      vatPercent: specification.VATPercent || 0,
    },
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

  await apiRequest<unknown>('/supplies/ukraine/order/packlists/sad/page/specification/import', {
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
  const result = await apiRequest<unknown>('/supplies/ukraine/order/sad/create', {
    method: 'POST',
    query: {
      sadNetId,
    },
    body: {
      fromDate: order.FromDate,
      organizationId: order.Organization?.Id || 0,
      supplierId: order.Supplier?.Id || 0,
      clientAgreementId: order.ClientAgreement?.Id || 0,
    },
  })

  return normalizeItem<SupplyOrderUkraine>(result)
}

export async function createIncomePaymentFromSad(
  sadNetId: string,
  paymentIncome: IncomePaymentOrder,
  operation?: AccountingMutationOperationOptions,
): Promise<IncomePaymentOrder | null> {
  const result = await executeAccountingMutation({
    identity: paymentIncome,
    kind: 'income-payment:add-sad',
    operation,
    payload: {
      paymentIncome,
      sadNetId,
    },
    request: (payload, context) => apiRequest<unknown>(CREATE_SAD_INCOME_ENDPOINT, {
      body: toSadPaymentRequest(payload.paymentIncome),
      dedupe: false,
      headers: context.headers,
      method: 'POST',
      query: {
        sadNetId: payload.sadNetId,
      },
      ...(context.signal ? { signal: context.signal } : {}),
    }),
  })

  return normalizeItem<IncomePaymentOrder>(result)
}

function toSadEditRequest(sad: Sad) {
  return {
    netUid: sad.NetUid,
    comment: sad.Comment || '',
    fromDate: sad.FromDate,
    marginAmount: sad.MarginAmount || 0,
    organizationId: sad.Organization?.Id || null,
    stathamId: sad.Statham?.Id || null,
    stathamCarId: sad.StathamCar?.Id || null,
    clientId: sad.Client?.Id || null,
    clientAgreementId: sad.ClientAgreement?.Id || null,
    organizationClientId: sad.OrganizationClient?.Id || null,
    organizationClientAgreementId:
      sad.OrganizationClientAgreement?.Id || null,
    items: (sad.SadItems || []).map((item) => ({
      id: item.Id || 0,
      supplyOrderUkraineCartItemId:
        item.SupplyOrderUkraineCartItemId || item.SupplyOrderUkraineCartItem?.Id || null,
      qty: item.ChangedQty ?? item.Qty ?? 0,
      netWeight: item.NetWeight || 0,
      unitPrice: item.UnitPrice || item.SupplyOrderUkraineCartItem?.UnitPrice || 0,
      comment: item.Comment || '',
    })),
  }
}

function toSadPaymentRequest(payment: IncomePaymentOrder) {
  const movement = payment.PaymentMovementOperation?.PaymentMovement
  return {
    amount: payment.Amount || 0,
    comment: payment.Comment || '',
    fromDate: payment.FromDate,
    organizationId: payment.Organization?.Id || 0,
    paymentMovementId: movement?.Id || 0,
    clientId: payment.ClientAgreement?.Client?.Id || null,
    clientAgreementId: payment.ClientAgreement?.Id || null,
    organizationClientId: payment.OrganizationClientAgreement?.OrganizationClientId || null,
    organizationClientAgreementId:
      payment.OrganizationClientAgreement?.Id || null,
    paymentRegisterId: payment.PaymentRegister?.Id || 0,
    currencyId: payment.Currency?.Id || 0,
    paymentCurrencyRegisterId: 0,
  }
}

function normalizeArray<TItem>(result: unknown): TItem[] {
  const parsedResult = unwrapPayload(parseJsonPayload(result))

  if (Array.isArray(parsedResult)) {
    return parsedResult as TItem[]
  }

  if (!parsedResult || typeof parsedResult !== 'object') {
    return []
  }

  const payload = parsedResult as Record<string, unknown>
  const items = payload.Items
    ?? payload.Sads
    ?? payload.Rows
    ?? payload.Data
    ?? payload.Collection
    ?? payload.Values
    ?? payload.items
    ?? payload.data
    ?? payload.rows

  if (Array.isArray(items)) {
    return items as TItem[]
  }

  return []
}

function normalizeItem<TItem>(result: unknown, ensure?: (item: TItem) => TItem): TItem | null {
  const item = unwrapPayload(parseJsonPayload(result))

  if (item && typeof item === 'object' && !Array.isArray(item)) {
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

function unwrapPayload(result: unknown): unknown {
  if (!result || typeof result !== 'object' || !('Body' in result)) {
    return result
  }

  return (result as { Body?: unknown }).Body
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
