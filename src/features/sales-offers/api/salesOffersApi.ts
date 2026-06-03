import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ClientShoppingCart,
  OfferClientAgreement,
  OfferProductReservation,
  OfferSubClientLink,
  OffersClientOption,
  OffersFilters,
  OffersProduct,
} from '../types'

const PUBLIC_OFFER_LINK_BASE = 'http://37.48.104.145:12202/account-security/current/offers/'

export function getPublicOfferLink(netUid: string): string {
  return `${PUBLIC_OFFER_LINK_BASE}${netUid}`
}

export async function getOffers(filters: OffersFilters): Promise<ClientShoppingCart[]> {
  const result = await apiRequest<unknown>('/sales/offers/all/filtered', {
    query: {
      from: filters.from.toDateString(),
      to: filters.to.toDateString(),
    },
  })

  return normalizeArray(result) as ClientShoppingCart[]
}

export async function processOffer(offer: ClientShoppingCart): Promise<void> {
  await apiRequest<unknown>('/sales/offers/process', {
    body: offer,
    method: 'POST',
  })
}

export async function restartOfferValidity(netId: string): Promise<void> {
  await apiRequest<unknown>('/sales/offers/update/validity', {
    method: 'PATCH',
    query: { netId, validDays: 2 },
  })
}

export async function createOffer(offer: ClientShoppingCart): Promise<ClientShoppingCart | null> {
  const result = await apiRequest<unknown>('/sales/offers/new', {
    body: offer,
    method: 'POST',
  })

  return result && typeof result === 'object' ? (result as ClientShoppingCart) : null
}

export async function searchOffersClients(value: string): Promise<OffersClientOption[]> {
  const result = await apiRequest<unknown>('/clients/payers/search/all', {
    query: {
      limit: 50,
      offset: 0,
      value: value.trim(),
    },
  })

  return normalizeArray(result) as OffersClientOption[]
}

export async function getOfferSubClients(clientNetId: string): Promise<OfferSubClientLink[]> {
  const result = await apiRequest<unknown>('/clients/all/clientsubclients/client', {
    query: { netId: clientNetId },
  })

  return normalizeArray(result) as OfferSubClientLink[]
}

export async function getOffersClientAgreements(clientNetId: string): Promise<OfferClientAgreement[]> {
  const result = await apiRequest<unknown>('/agreements/client/all', {
    query: { netId: clientNetId },
  })

  return normalizeArray(result) as OfferClientAgreement[]
}

export async function searchOffersProducts(value: string): Promise<OffersProduct[]> {
  const result = await apiRequest<unknown>('/products/search/vendorcode', {
    query: { limit: 20, offset: 0, value: value.trim() },
  })

  return normalizeArray(result) as OffersProduct[]
}

export async function getOfferProductAvailableQtyUk(productNetId: string, clientAgreementNetId: string): Promise<number> {
  const result = await apiRequest<unknown>('/products/reservations/current/carousel/agreement', {
    query: { clientAgreementNetId, productNetId },
  })

  const reservation = normalizeArray(result)[0] as OfferProductReservation | undefined

  return reservation?.AvailableQtyUk ?? reservation?.AvailableQty ?? 0
}

function normalizeArray(result: unknown): unknown[] {
  const parsed = typeof result === 'string' ? safeParse(result) : result

  if (Array.isArray(parsed)) {
    return parsed
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>

    for (const key of [
      'Items',
      'Offers',
      'Carts',
      'ClientShoppingCarts',
      'Clients',
      'Products',
      'ClientAgreements',
      'Agreements',
      'Data',
      'Collection',
    ]) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[]
      }
    }
  }

  return []
}

function safeParse(value: string): unknown {
  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  try {
    return JSON.parse(normalized) as unknown
  } catch {
    return null
  }
}
