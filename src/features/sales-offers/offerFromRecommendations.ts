import type { RecommendationProduct } from '../clients/recommendationsTypes'
import type { ClientShoppingCart, OfferClientAgreement } from './types'

// Builds the minimal POST /sales/offers/new body from AI-recommendation selections.
// Prices are never sent — the server re-derives agreement prices when the offer is read.
export function buildOfferFromRecommendations(
  agreement: OfferClientAgreement,
  products: RecommendationProduct[],
): ClientShoppingCart {
  return {
    ClientAgreement: agreement,
    Comment: 'Сформовано з AI-рекомендацій',
    OrderItems: products.map((product) => ({
      Product: {
        Id: product.Id,
        Name: product.Name,
        NetUid: product.NetUid,
        VendorCode: product.VendorCode,
      },
      Qty: 1,
    })),
  }
}
