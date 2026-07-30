import type { ClientShoppingCart } from '../../sales-offers/types'

export type OfferLifecycle = 'ordered' | 'expired' | 'viewed' | 'sent'

export function getOfferLifecycle(
  offer: ClientShoppingCart,
  now = new Date(),
): OfferLifecycle {
  if (offer.IsOfferProcessed) {
    return 'ordered'
  }

  const validUntil = offer.ValidUntil ? new Date(offer.ValidUntil) : null
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  if (validUntil && !Number.isNaN(validUntil.getTime()) && validUntil < today) {
    return 'expired'
  }

  return offer.ViewedAt ? 'viewed' : 'sent'
}
