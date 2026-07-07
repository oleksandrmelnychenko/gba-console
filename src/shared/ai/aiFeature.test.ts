import { describe, expect, it } from 'vitest'
import { hasAiFeatureDescendant, isAiFeatureRoute, isAiFeatureTarget } from './aiFeature'

describe('ai feature marker helpers', () => {
  it('detects known AI routes', () => {
    expect(isAiFeatureRoute('/products/assortment')).toBe(true)
    expect(isAiFeatureRoute('sales/ukraine/prediction')).toBe(true)
    expect(isAiFeatureRoute('/basket-supply-ukraine-order/cockpit')).toBe(true)
    expect(isAiFeatureRoute('/sales/ukraine/all')).toBe(false)
  })

  it('detects AI labels and descendants', () => {
    expect(isAiFeatureTarget({ Module: 'Завдання продажів', Route: '/sales/cockpit' })).toBe(true)
    expect(hasAiFeatureDescendant({
      Children: [
        { Module: 'Продажі', Route: '/sales/ukraine/all' },
        { Module: 'Аналітика асортименту', Route: '/products/assortment' },
      ],
    })).toBe(true)
  })
})
