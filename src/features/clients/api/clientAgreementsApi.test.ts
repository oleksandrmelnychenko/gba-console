import { describe, expect, it } from 'vitest'
import { mergeProductGroupDiscounts } from './clientAgreementsApi'
import type { ProductGroup } from '../../product-groups/types'
import type { ProductGroupDiscount } from '../types'

describe('mergeProductGroupDiscounts', () => {
  it('creates default discounts for missing product subgroups', () => {
    const childGroup: ProductGroup = {
      Id: 2,
      NetUid: 'child-group',
      Name: 'Child group',
      SubProductGroups: [],
    }
    const rootGroup: ProductGroup = {
      Id: 1,
      NetUid: 'root-group',
      Name: 'Root group',
      SubProductGroups: [{ SubProductGroup: childGroup }],
    }

    const result = mergeProductGroupDiscounts([rootGroup], [])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      DiscountRate: 0,
      IsActive: true,
      ProductGroup: rootGroup,
      ProductGroupId: 1,
    })
    expect(result[0].SubProductGroupDiscounts).toHaveLength(1)
    expect(result[0].SubProductGroupDiscounts?.[0]).toMatchObject({
      DiscountRate: 0,
      IsActive: true,
      ProductGroup: childGroup,
      ProductGroupId: 2,
    })
  })

  it('preserves existing root and subgroup discount values', () => {
    const childGroup: ProductGroup = {
      Id: 2,
      NetUid: 'child-group',
      Name: 'Child group',
      SubProductGroups: [],
    }
    const rootGroup: ProductGroup = {
      Id: 1,
      NetUid: 'root-group',
      Name: 'Root group',
      SubProductGroups: [{ SubProductGroup: childGroup }],
    }
    const existingDiscounts: ProductGroupDiscount[] = [
      {
        Id: 10,
        ClientAgreementId: 20,
        DiscountRate: 12,
        IsActive: false,
        ProductGroupId: 1,
        SubProductGroupDiscounts: [
          {
            Id: 11,
            ClientAgreementId: 20,
            DiscountRate: 7,
            IsActive: true,
            ProductGroupId: 2,
          },
        ],
      },
    ]

    const result = mergeProductGroupDiscounts([rootGroup], existingDiscounts)

    expect(result[0]).toMatchObject({
      ClientAgreementId: 20,
      DiscountRate: 12,
      Id: 10,
      IsActive: false,
      ProductGroup: rootGroup,
      ProductGroupId: 1,
    })
    expect(result[0].SubProductGroupDiscounts?.[0]).toMatchObject({
      ClientAgreementId: 20,
      DiscountRate: 7,
      Id: 11,
      IsActive: true,
      ParentProductGroupDiscountId: 10,
      ProductGroup: childGroup,
      ProductGroupId: 2,
    })
  })

  it('refreshes stale child parent ids from the matched parent discount', () => {
    const childGroup: ProductGroup = {
      Id: 2,
      NetUid: 'child-group',
      Name: 'Child group',
      SubProductGroups: [],
    }
    const rootGroup: ProductGroup = {
      Id: 1,
      NetUid: 'root-group',
      Name: 'Root group',
      SubProductGroups: [{ SubProductGroup: childGroup }],
    }
    const result = mergeProductGroupDiscounts(
      [rootGroup],
      [
        {
          Id: 10,
          ProductGroupId: 1,
          SubProductGroupDiscounts: [
            {
              Id: 11,
              ParentProductGroupDiscountId: 999,
              ProductGroupId: 2,
            },
          ],
        },
      ],
    )

    expect(result[0].SubProductGroupDiscounts?.[0]?.ParentProductGroupDiscountId).toBe(10)
  })
})
