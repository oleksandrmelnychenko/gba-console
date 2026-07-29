import { apiRequest } from '../../../shared/api/apiClient'
import { SHOP_BASE_URL } from '../../../shared/config/env'
import { formatDateForQuery } from '../../../shared/date/dateTime'
import {
  getSalesMutationOperationHeaders,
  SalesMutationPreflightValidationError,
  type SalesMutationOperationOptions,
} from '../../sales-ukraine/salesMutationOperation'
import {
  requirePersistedGuid,
  requirePositiveFiniteQuantity,
} from '../../sales-ukraine/salesPayloadGuards'
import type {
  ClientShoppingCart,
  OfferClientAgreement,
  OfferOrderItem,
  OfferProductReservation,
  OfferSubClientLink,
  OffersClientOption,
  OffersFilters,
  OffersProduct,
} from '../types'

// The customer-facing offer link opens the PUBLIC storefront page (/offer/{netUid}) — viewable
// without a session (the unguessable netUid is the token); ordering leads through sign-in into
// the account offer page with returnUrl preserved.
export function getPublicOfferLink(netUid: string): string {
  return `${SHOP_BASE_URL.replace(/\/+$/, '')}/offer/${netUid}`
}

export async function getOffers(filters: OffersFilters): Promise<ClientShoppingCart[]> {
  const result = await apiRequest<unknown>('/sales/offers/all/filtered', {
    query: {
      from: formatDateForQuery(filters.from),
      to: formatDateForQuery(filters.to),
    },
  })

  return normalizeArray(result) as ClientShoppingCart[]
}

export async function processOffer(
  offer: ClientShoppingCart,
  operation: SalesMutationOperationOptions,
): Promise<void> {
  validatePersistedOffer(offer)

  await apiRequest<unknown>('/sales/offers/process', {
    body: offer,
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'POST',
    signal: operation.signal,
  })
}

export async function restartOfferValidity(
  netId: string,
  operation: SalesMutationOperationOptions,
): Promise<void> {
  const persistedNetId = requirePersistedGuid(netId, 'Оферта не має коректного ідентифікатора')

  await apiRequest<unknown>('/sales/offers/update/validity', {
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'PATCH',
    query: { netId: persistedNetId, validDays: 2 },
    signal: operation.signal,
  })
}

export async function createOffer(
  offer: ClientShoppingCart,
  operation: SalesMutationOperationOptions,
  validDays?: number,
): Promise<ClientShoppingCart | null> {
  validateNewOffer(offer)

  const result = await apiRequest<unknown>('/sales/offers/new', {
    body: offer,
    headers: getSalesMutationOperationHeaders(operation.operationId),
    method: 'POST',
    query: validDays && Number.isFinite(validDays) && validDays > 0 ? { validDays } : undefined,
    signal: operation.signal,
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

function validateNewOffer(offer: ClientShoppingCart): void {
  if ((offer.Id ?? 0) > 0 || offer.NetUid) {
    throw new SalesMutationPreflightValidationError(
      'Нова оферта не може містити збережений ідентифікатор',
    )
  }

  const agreement = offer.ClientAgreement

  if ((agreement?.Id ?? 0) <= 0) {
    throw new SalesMutationPreflightValidationError(
      'Оберіть збережений договір клієнта',
    )
  }

  requirePersistedGuid(agreement?.NetUid, 'Оберіть збережений договір клієнта')
  validateOfferItems(offer.OrderItems, false)
}

function validatePersistedOffer(offer: ClientShoppingCart): void {
  if ((offer.Id ?? 0) <= 0) {
    throw new SalesMutationPreflightValidationError(
      'Оферта не має коректного ідентифікатора',
    )
  }

  requirePersistedGuid(offer.NetUid, 'Оферта не має коректного ідентифікатора')

  if (offer.Deleted) {
    return
  }

  validateOfferItems(offer.OrderItems, true)
}

function validateOfferItems(items: OfferOrderItem[] | undefined, requirePersistedItems: boolean): void {
  if (!items?.length) {
    throw new SalesMutationPreflightValidationError(
      'Додайте хоча б один товар до оферти',
    )
  }

  const productNetIds = new Set<string>()

  for (const item of items) {
    if (requirePersistedItems) {
      if ((item.Id ?? 0) <= 0) {
        throw new SalesMutationPreflightValidationError(
          'Позиція оферти не має коректного ідентифікатора',
        )
      }

      requirePersistedGuid(item.NetUid, 'Позиція оферти не має коректного ідентифікатора')
    }

    if ((item.Product?.Id ?? 0) <= 0) {
      throw new SalesMutationPreflightValidationError(
        'Товар оферти не має коректного ідентифікатора',
      )
    }

    const productNetId = requirePersistedGuid(
      item.Product?.NetUid,
      'Товар оферти не має коректного ідентифікатора',
    )

    if (productNetIds.has(productNetId)) {
      throw new SalesMutationPreflightValidationError(
        'Один товар не можна додати до оферти двічі',
      )
    }

    productNetIds.add(productNetId)
    requirePositiveFiniteQuantity(item.Qty, 'Кількість товару в оферті має бути більшою за нуль')
  }
}
