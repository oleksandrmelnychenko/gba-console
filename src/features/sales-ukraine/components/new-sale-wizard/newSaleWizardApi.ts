import { apiRequest } from '../../../../shared/api/apiClient'
import {
  getSalesMutationOperationHeaders,
  SalesMutationPreflightValidationError,
  withSalesMutationOperationNetUid,
  type SalesMutationOperationOptions,
} from '../../salesMutationOperation'
import { requirePersistedGuid, requirePositiveFiniteQuantity } from '../../salesPayloadGuards'
import type { SalesUkraineOrderItem, SalesUkraineProduct } from '../../types'
import type { WizardSaleProduct } from './wizardSaleProduct'

export type WizardDeliveryRecipientAddress = {
  Id?: number
  NetUid?: string
  City?: string
  Department?: string
  DeliveryRecipient?: WizardDeliveryRecipient | null
  DeliveryRecipientId?: number
  Value?: string
}

export type WizardDeliveryRecipient = {
  Id?: number
  NetUid?: string
  ClientId?: number
  FullName?: string
  MobilePhone?: string
  DeliveryRecipientAddresses?: WizardDeliveryRecipientAddress[]
}

export type WizardReservationOrderItem = Pick<
  SalesUkraineOrderItem,
  | 'Comment'
  | 'Discount'
  | 'Id'
  | 'IsFromReSale'
  | 'NetUid'
  | 'OneTimeDiscount'
  | 'OneTimeDiscountComment'
  | 'PricePerItem'
  | 'Qty'
  | 'SourceOrderItemNetUid'
> & {
  Order?: { Sales?: { NetUid?: string; SaleNumber?: { Value?: string } | null }[] } | null
  Product?: SalesUkraineProduct | null
  User?: { LastName?: string } | null
}

export type WizardProductReservation = {
  ProductNetUid?: string
  ProductId?: number
  AvailableQty?: number
  AvailableQtyUk?: number
  ReservedQty?: number
  Price?: number
  PricePerItem?: number
  VAT?: number
  Qty?: number
  RegionCode?: string
  OrderItem?: WizardReservationOrderItem | null
}

export type WizardAvailabilityRow = {
  Amount?: number
  Name?: string
  NetId?: string
  OrderItem?: WizardReservationOrderItem | null
  RegionCode?: string
}

export type WizardTotalProductAvailabilities = {
  AvailableQtyUkReSale?: WizardAvailabilityRow[]
  AvailabilityInvoiceModel?: WizardAvailabilityRow[]
  InAccounts?: WizardAvailabilityRow[]
  InStoragePl?: WizardAvailabilityRow[]
  InStorageUkrNotVat?: WizardAvailabilityRow[]
  InStorageUkrVat?: WizardAvailabilityRow[]
  OnWayToPl?: WizardAvailabilityRow[]
  OnWayToUkr?: WizardAvailabilityRow[]
  TotalAvailabilities?: Record<string, number>
}

export type WizardProductAvailabilityBuckets = {
  AvailableQtyPl?: number
  AvailableQtyUk?: number
  AvailableQtyUkReSale?: number
  AvailableQtyUkVAT?: number
}

export type WizardCalculatedProductPricing = {
  DiscountPriceEUR?: number
  DiscountRate?: number
  PriceEUR?: number
  Pricing?: {
    Id?: number
    Name?: string
    NetUid?: string
  } | null
  RetailPriceEUR?: number
  RetailPriceLocal?: number
}

export type WizardSubClient = {
  Id?: number
  NetUid?: string
  FullName?: string
  Name?: string
}

function asArray<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[]
  }

  if (result && typeof result === 'object') {
    const payload = result as Record<string, unknown>

    if (Array.isArray(payload.Items)) {
      return payload.Items as T[]
    }

    if (Array.isArray(payload.Collection)) {
      return payload.Collection as T[]
    }
  }

  return []
}

function asArrayOrSingle<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[]
  }

  if (result && typeof result === 'object') {
    const payload = result as Record<string, unknown>

    if (Array.isArray(payload.Items)) {
      return payload.Items as T[]
    }

    if (Array.isArray(payload.Collection)) {
      return payload.Collection as T[]
    }

    return [result as T]
  }

  return []
}

function asNumber(result: unknown): number | null {
  if (typeof result === 'number') {
    return Number.isFinite(result) ? result : null
  }

  if (typeof result === 'string') {
    const parsed = Number(result)

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

// --- Product search (agreement + VAT aware, carries availability buckets) ---

export type WizardProductSearchOptions = {
  limit?: number
  mode?: string
  offset?: number
  signal?: AbortSignal
  sortMode?: string
}

export async function searchSaleProductsWithAvailability(
  value: string,
  clientAgreementNetId: string,
  options?: WizardProductSearchOptions,
): Promise<WizardSaleProduct[]> {
  const result = await apiRequest<unknown>('/products/search/advanced', {
    query: {
      limit: options?.limit ?? 20,
      mode: options?.mode ?? '5',
      netId: clientAgreementNetId,
      offset: options?.offset ?? 0,
      sortMode: options?.sortMode ?? '2',
      value: value.trim(),
    },
    ...(options?.signal ? { signal: options.signal } : {}),
  })

  return asArray<WizardSaleProduct>(result)
}

export async function getProductAnalogues(
  productNetId: string,
  clientAgreementNetId: string,
  signal?: AbortSignal,
): Promise<WizardSaleProduct[]> {
  const result = await apiRequest<unknown>('/products/get/analogues', {
    query: { clientAgreementNetId, productNetId },
    ...(signal ? { signal } : {}),
  })

  return asArray<WizardSaleProduct>(result)
}

export async function getAllProductAvailabilities(
  productNetId: string,
  clientAgreementNetId: string,
  saleNetId: string,
  signal?: AbortSignal,
): Promise<WizardTotalProductAvailabilities | null> {
  const result = await apiRequest<unknown>('/products/availabilities/all', {
    query: { clientAgreementNetId, netId: productNetId, saleNetId },
    ...(signal ? { signal } : {}),
  })

  return result && typeof result === 'object' && !Array.isArray(result) ? (result as WizardTotalProductAvailabilities) : null
}

export async function getProductAvailabilityBuckets(
  productNetId: string,
  clientAgreementNetId: string,
): Promise<WizardProductAvailabilityBuckets | null> {
  const result = await apiRequest<unknown>('/products/all/availabilities/product', {
    cache: 'no-store',
    query: { clientAgreementNetId, netId: productNetId },
  })

  return result && typeof result === 'object' && !Array.isArray(result) ? (result as WizardProductAvailabilityBuckets) : null
}

export async function shiftOrderItemFromSale(
  saleFromNetId: string,
  saleToNetId: string,
  orderItem: SalesUkraineOrderItem | WizardReservationOrderItem,
  operation: SalesMutationOperationOptions,
): Promise<void> {
  const sourceOrderItemNetUid = normalizePersistedNetUid(orderItem.NetUid)

  if (!sourceOrderItemNetUid) {
    throw new Error('Неможливо перемістити незбережену позицію')
  }

  await apiRequest<unknown>('/orders/items/shift/specific', {
    body: withSalesMutationOperationNetUid({
      ...orderItem,
      NetUid: sourceOrderItemNetUid,
      SourceOrderItemNetUid: sourceOrderItemNetUid,
    }, operation.operationId),
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'POST',
    query: { saleFromNetId, saleToNetId },
    ...(operation.signal ? { signal: operation.signal } : {}),
  })
}

function normalizePersistedNetUid(value: string | null | undefined): string {
  const netUid = value?.trim().toLowerCase() ?? ''

  return netUid === '00000000-0000-0000-0000-000000000000' ? '' : netUid
}

// --- Delivery recipients ---------------------------------------------------

export async function getClientDeliveryRecipients(clientNetId: string): Promise<WizardDeliveryRecipient[]> {
  const result = await apiRequest<unknown>('/deliveries/recipients/all/client', {
    query: { netId: clientNetId },
  })

  return asArray<WizardDeliveryRecipient>(result)
}

export async function newDeliveryRecipient(recipient: WizardDeliveryRecipient): Promise<WizardDeliveryRecipient | null> {
  const result = await apiRequest<unknown>('/deliveries/recipients/new', {
    body: recipient,
    method: 'POST',
  })

  return result && typeof result === 'object' ? (result as WizardDeliveryRecipient) : null
}

export async function newDeliveryRecipientAddress(
  address: WizardDeliveryRecipientAddress & { RecipientNetId?: string; RecipientId?: number },
): Promise<WizardDeliveryRecipientAddress | null> {
  const result = await apiRequest<unknown>('/deliveries/recipients/addresses/new', {
    body: address,
    method: 'POST',
  })

  return result && typeof result === 'object' ? (result as WizardDeliveryRecipientAddress) : null
}

export async function updateSaleDeliveryRecipient(
  recipient: WizardDeliveryRecipient,
  saleNetId: string,
  operation: SalesMutationOperationOptions,
): Promise<WizardDeliveryRecipient | null> {
  const persistedSaleNetId = requirePersistedGuid(
    saleNetId,
    'Продаж не має збереженого ідентифікатора',
  )
  const result = await apiRequest<unknown>('/sales/update/recipient', {
    body: withSalesMutationOperationNetUid(recipient, operation.operationId),
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'POST',
    query: { netId: persistedSaleNetId },
    ...(operation.signal ? { signal: operation.signal } : {}),
  })

  return result && typeof result === 'object' && !Array.isArray(result)
    ? (result as WizardDeliveryRecipient)
    : null
}

export async function updateSaleDeliveryRecipientAddress(
  address: WizardDeliveryRecipientAddress,
  saleNetId: string,
  operation: SalesMutationOperationOptions,
): Promise<WizardDeliveryRecipientAddress | null> {
  const persistedSaleNetId = requirePersistedGuid(
    saleNetId,
    'Продаж не має збереженого ідентифікатора',
  )
  const result = await apiRequest<unknown>('/sales/update/recipient/address', {
    body: withSalesMutationOperationNetUid(address, operation.operationId),
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'POST',
    query: { netId: persistedSaleNetId },
    ...(operation.signal ? { signal: operation.signal } : {}),
  })

  return result && typeof result === 'object' && !Array.isArray(result)
    ? (result as WizardDeliveryRecipientAddress)
    : null
}

// --- Carousel availability / reservations ---------------------------------

export async function getProductReservationsByAgreement(
  clientAgreementNetId: string,
  productNetId: string,
): Promise<WizardProductReservation[]> {
  const result = await apiRequest<unknown>('/products/reservations/current/carousel/agreement', {
    query: { clientAgreementNetId, productNetId },
  })

  return asArrayOrSingle<WizardProductReservation>(result)
}

export async function getProductCurrentPriceByAgreement(productNetId: string, clientAgreementNetId: string): Promise<number | null> {
  const result = await apiRequest<unknown>('/products/pricings/current', {
    query: { clientAgreementNetId, productNetId },
  })

  return asNumber(result)
}

export async function getProductCalculatedPricingsByAgreement(
  productNetId: string,
  clientAgreementNetId: string,
): Promise<WizardCalculatedProductPricing[]> {
  const result = await apiRequest<unknown>('/products/pricings/all', {
    query: { clientAgreementNetId, productNetId },
  })

  return asArrayOrSingle<WizardCalculatedProductPricing>(result)
}

// --- Future / reservation sale --------------------------------------------

export type WizardNearestSupplyOrder = {
  NetUID?: string
  NetUid?: string
  OrderArrivedDate?: string
  Number?: string
  Qty?: number
}

export type WizardFutureReservation = {
  ClientNetId?: string
  ProductNetId?: string
  Count: number
  SupplyOrderNetId?: string
  RemindDate?: string
}

export async function getNearestSupplyOrder(
  productNetId: string,
  signal?: AbortSignal,
): Promise<WizardNearestSupplyOrder | null> {
  const result = await apiRequest<unknown>('/supplies/orders/arrival/nearest/get', {
    query: { netId: productNetId },
    ...(signal ? { signal } : {}),
  })

  return result && typeof result === 'object' ? (result as WizardNearestSupplyOrder) : null
}

export async function createFutureReservation(
  reservation: WizardFutureReservation,
  operation: SalesMutationOperationOptions,
): Promise<void> {
  const clientNetId = requirePersistedGuid(
    reservation.ClientNetId,
    'Оберіть клієнта для резервування',
  )
  const productNetId = requirePersistedGuid(
    reservation.ProductNetId,
    'Не вдалося визначити товар для резервування',
  )
  const supplyOrderNetId = requirePersistedGuid(
    reservation.SupplyOrderNetId,
    'Не вдалося визначити поставку для резервування',
  )
  const count = requirePositiveFiniteQuantity(
    reservation.Count,
    'Вкажіть коректну кількість для резервування',
  )
  const remindDate = reservation.RemindDate?.trim() || ''
  const parsedDate = new Date(remindDate)

  if (
    !remindDate ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getUTCFullYear() < 1753 ||
    parsedDate.getUTCFullYear() > 9999
  ) {
    throw new SalesMutationPreflightValidationError('Не вдалося визначити дату поставки')
  }

  await apiRequest<unknown>('/sales/reservations/new', {
    body: withSalesMutationOperationNetUid({
      ClientNetId: clientNetId,
      Count: count,
      ProductNetId: productNetId,
      RemindDate: remindDate,
      SupplyOrderNetId: supplyOrderNetId,
    }, operation.operationId),
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'POST',
    signal: operation.signal,
  })
}

// --- Sub-clients (merged) --------------------------------------------------

export async function getSubClients(clientNetId: string): Promise<WizardSubClient[]> {
  const result = await apiRequest<unknown>('/clients/all/subclients/client', {
    query: { netId: clientNetId },
  })

  return asArray<WizardSubClient>(result)
}
