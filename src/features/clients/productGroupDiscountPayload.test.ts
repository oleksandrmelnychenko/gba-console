import { describe, expect, it } from 'vitest'
import { mergeProductGroupDiscounts } from './api/clientAgreementsApi'
import { compactChangedProductGroupDiscounts, toSaveDiscount } from './productGroupDiscountPayload'
import type { ProductGroup } from '../product-groups/types'
import type { ProductGroupDiscount } from './types'

const groups: ProductGroup[] = [
  { Id: 1, NetUid: 'g1', Name: 'Group 1', SubProductGroups: [] },
  { Id: 2, NetUid: 'g2', Name: 'Group 2', SubProductGroups: [] },
]

describe('compactChangedProductGroupDiscounts', () => {
  it('serializes the general ("Усі вибрані") percent applied to every group', () => {
    const baseline = mergeProductGroupDiscounts(groups, [])
    // "Усі вибрані" selects every group and stamps the same percent on all of them.
    const edited = baseline.map((discount) => ({ ...discount, DiscountRate: 50 }))

    const payload = compactChangedProductGroupDiscounts(edited, baseline)

    expect(payload).toHaveLength(2)
    expect(payload.every((discount) => discount.DiscountRate === 50)).toBe(true)
    expect(payload.map((discount) => discount.ProductGroupId)).toEqual([1, 2])
  })

  it('keeps the general discount through a save -> reload cycle', () => {
    const baseline = mergeProductGroupDiscounts(groups, [])
    const edited = baseline.map((discount) => ({ ...discount, DiscountRate: 50 }))
    const payload = compactChangedProductGroupDiscounts(edited, baseline)

    // Re-merge the saved payload onto a fresh catalog (what happens on reopen).
    const reloaded = mergeProductGroupDiscounts(groups, payload)

    expect(reloaded.map((discount) => discount.DiscountRate)).toEqual([50, 50])
  })

  it('emits only the rows whose percent actually changed', () => {
    const baseline = mergeProductGroupDiscounts(groups, [
      { ProductGroupId: 1, DiscountRate: 50, IsActive: true },
    ])
    const edited = baseline.map((discount) =>
      discount.ProductGroupId === 2 ? { ...discount, DiscountRate: 50 } : discount,
    )

    const payload = compactChangedProductGroupDiscounts(edited, baseline)

    expect(payload).toHaveLength(1)
    expect(payload[0]).toMatchObject({ ProductGroupId: 2, DiscountRate: 50 })
  })
})

describe('toSaveDiscount', () => {
  it('flattens sub-discounts and drops the transient IsSelected flag', () => {
    const discount: ProductGroupDiscount = {
      Id: 10,
      ProductGroupId: 1,
      DiscountRate: 25,
      IsActive: true,
      IsSelected: true,
      ProductGroup: { Id: 1, NetUid: 'g1', Name: 'Group 1', FullName: 'Group 1' },
      SubProductGroupDiscounts: [{ ProductGroupId: 2, DiscountRate: 5 }],
    }

    const saved = toSaveDiscount(discount)

    expect(saved.IsSelected).toBeUndefined()
    expect(saved.SubProductGroupDiscounts).toEqual([])
    expect(saved.ProductGroupId).toBe(1)
    expect(saved.ProductGroup).toEqual({ Id: 1, NetUid: 'g1', Name: 'Group 1', FullName: 'Group 1' })
  })
})
