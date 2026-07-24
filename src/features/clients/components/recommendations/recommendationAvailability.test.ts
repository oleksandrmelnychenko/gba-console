import { describe, expect, it } from 'vitest'
import {
  canSelectRecommendationProduct,
  getRecommendationAvailableQty,
  hasRecommendationAvailabilityData,
} from './recommendationAvailability'

describe('recommendation availability', () => {
  it('uses regular and resale stock for a non-VAT sale', () => {
    const product = {
      AvailableQtyUk: 2,
      AvailableQtyUkReSale: 3,
      AvailableQtyUkVAT: 9,
    }

    expect(getRecommendationAvailableQty(product, false)).toBe(5)
    expect(canSelectRecommendationProduct(product, false)).toBe(true)
  })

  it('uses only VAT stock for a VAT sale', () => {
    const product = {
      AvailableQtyUk: 8,
      AvailableQtyUkReSale: 4,
      AvailableQtyUkVAT: 0,
    }

    expect(getRecommendationAvailableQty(product, true)).toBe(0)
    expect(canSelectRecommendationProduct(product, true)).toBe(false)
  })

  it('does not allow selecting zero or unknown availability', () => {
    expect(canSelectRecommendationProduct({ AvailableQtyUk: 0, AvailableQtyUkReSale: 0 }, false)).toBe(false)
    expect(canSelectRecommendationProduct({}, false)).toBe(false)
    expect(hasRecommendationAvailabilityData({}, false)).toBe(false)
  })
})
