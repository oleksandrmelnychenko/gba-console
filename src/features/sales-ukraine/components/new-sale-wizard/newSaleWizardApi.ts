import { apiRequest } from '../../../../shared/api/apiClient'
import type { SalesUkraineSale } from '../../types'

export type WizardDeliveryRecipientAddress = {
  Id?: number
  NetUid?: string
  City?: string
  Department?: string
  Address?: string
}

export type WizardDeliveryRecipient = {
  Id?: number
  NetUid?: string
  FullName?: string
  MobilePhone?: string
  DeliveryRecipientAddresses?: WizardDeliveryRecipientAddress[]
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

function asSale(result: unknown): SalesUkraineSale | null {
  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>
    const nested = record.Sale

    if (nested && typeof nested === 'object') {
      return nested as SalesUkraineSale
    }

    return result as SalesUkraineSale
  }

  return null
}

// --- Carrier (review confirm) ---------------------------------------------

export async function setSaleCarrier(sale: SalesUkraineSale, file: File | null): Promise<SalesUkraineSale | null> {
  const formData = new FormData()
  formData.append('sale', JSON.stringify(sale))

  if (file) {
    formData.append('file', file)
  }

  const result = await apiRequest<unknown>('/sales/set/change', {
    body: formData,
    method: 'POST',
  })

  return asSale(result)
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

export async function updateSaleDeliveryRecipient(sale: SalesUkraineSale, saleNetId: string): Promise<SalesUkraineSale | null> {
  const result = await apiRequest<unknown>('/sales/update/recipient', {
    body: sale,
    method: 'POST',
    query: { netId: saleNetId },
  })

  return asSale(result)
}

export async function updateSaleDeliveryRecipientAddress(sale: SalesUkraineSale, saleNetId: string): Promise<SalesUkraineSale | null> {
  const result = await apiRequest<unknown>('/sales/update/recipient/address', {
    body: sale,
    method: 'POST',
    query: { netId: saleNetId },
  })

  return asSale(result)
}

// --- Carousel availability / reservations ---------------------------------

export async function getProductReservationsByAgreement(clientAgreementNetId: string): Promise<WizardProductReservation[]> {
  const result = await apiRequest<unknown>('/products/reservations/current/carousel/agreement', {
    query: { clientAgreementNetId },
  })

  return asArray<WizardProductReservation>(result)
}

// --- Future / reservation sale --------------------------------------------

export type WizardNearestSupplyOrder = {
  NetUID?: string
  NetUid?: string
  OrderArrivedDate?: string
  Number?: string
}

export type WizardFutureReservation = {
  ClientNetId?: string
  ProductNetId?: string
  Count: number
  SupplyOrderNetId?: string
  RemindDate?: string
}

export async function getNearestSupplyOrder(productNetId: string): Promise<WizardNearestSupplyOrder | null> {
  const result = await apiRequest<unknown>('/supplies/orders/arrival/nearest/get', {
    query: { netId: productNetId },
  })

  return result && typeof result === 'object' ? (result as WizardNearestSupplyOrder) : null
}

export async function createFutureReservation(reservation: WizardFutureReservation): Promise<void> {
  await apiRequest<unknown>('/sales/reservations/new', {
    body: reservation,
    method: 'POST',
  })
}

// --- Sub-clients (merged) --------------------------------------------------

export async function getSubClients(clientNetId: string): Promise<WizardSubClient[]> {
  const result = await apiRequest<unknown>('/clients/all/subclients/client', {
    query: { netId: clientNetId },
  })

  return asArray<WizardSubClient>(result)
}
