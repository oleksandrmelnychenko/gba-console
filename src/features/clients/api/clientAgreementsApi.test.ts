import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

vi.mock('../../product-groups/api/productGroupsApi', () => ({
  getAllProductGroups: vi.fn(),
  getRootProductGroups: vi.fn(),
  getProductGroups: vi.fn(),
}))

import { apiRequest } from '../../../shared/api/apiClient'
import { getAllProductGroups, getRootProductGroups } from '../../product-groups/api/productGroupsApi'
import { exportAgreementDocument, getAgreementProductGroupDiscounts, mergeProductGroupDiscounts } from './clientAgreementsApi'
import type { ProductGroup } from '../../product-groups/types'
import type { ProductGroupDiscount } from '../types'

const apiRequestMock = vi.mocked(apiRequest)

describe('getAgreementProductGroupDiscounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiRequestMock.mockReset()
  })

  it('loads the full product-group catalog (all-groups endpoint) and builds discount rows', async () => {
    vi.mocked(getAllProductGroups).mockResolvedValue([
      { Id: 1, NetUid: 'g1', Name: 'Group 1', SubProductGroups: [] },
      { Id: 2, NetUid: 'g2', Name: 'Group 2', SubProductGroups: [] },
    ])

    const result = await getAgreementProductGroupDiscounts([])

    expect(getAllProductGroups).toHaveBeenCalledTimes(1)
    expect(getRootProductGroups).not.toHaveBeenCalled()
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ ProductGroupId: 1, DiscountRate: 0 })
    expect(result[1]).toMatchObject({ ProductGroupId: 2, DiscountRate: 0 })
  })

  it('uses the root-scoped catalog when a root net id is supplied', async () => {
    vi.mocked(getRootProductGroups).mockResolvedValue([
      { Id: 3, NetUid: 'g3', Name: 'Group 3', SubProductGroups: [] },
    ])

    const result = await getAgreementProductGroupDiscounts([], 'root-net')

    expect(getRootProductGroups).toHaveBeenCalledWith('root-net')
    expect(getAllProductGroups).not.toHaveBeenCalled()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ ProductGroupId: 3 })
  })
})

describe('exportAgreementDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiRequestMock.mockReset()
  })

  it('exports agreement documents with PDF-first aliases preserved', async () => {
    apiRequestMock.mockResolvedValueOnce({
      PdfDocument: 'https://example.test/agreement.pdf',
      XlsxDocument: 'https://example.test/agreement.xlsx',
    })

    await expect(exportAgreementDocument('agreement-net')).resolves.toEqual({
      DocumentURL: 'https://example.test/agreement.xlsx',
      PdfDocumentURL: 'https://example.test/agreement.pdf',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/agreements/get/document', {
      query: {
        netId: 'agreement-net',
        type: 0,
      },
    })
  })
})

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

  it('does not infinite-loop on circular subgroup references', () => {
    const rootGroup: ProductGroup = { Id: 1, NetUid: 'root-group', Name: 'Root group', SubProductGroups: [] }
    rootGroup.SubProductGroups = [{ SubProductGroup: rootGroup }]

    const result = mergeProductGroupDiscounts([rootGroup], [])

    expect(result).toHaveLength(1)
    expect(result[0].ProductGroupId).toBe(1)
    expect(result[0].SubProductGroupDiscounts).toEqual([])
  })

  it('tolerates null or non-array SubProductGroupDiscounts in existing discounts', () => {
    const childGroup: ProductGroup = { Id: 2, NetUid: 'child-group', Name: 'Child group', SubProductGroups: [] }
    const rootGroup: ProductGroup = {
      Id: 1,
      NetUid: 'root-group',
      Name: 'Root group',
      SubProductGroups: [{ SubProductGroup: childGroup }],
    }
    const existingDiscounts = [
      { Id: 10, ProductGroupId: 1, DiscountRate: 9, SubProductGroupDiscounts: null } as unknown as ProductGroupDiscount,
    ]

    expect(() => mergeProductGroupDiscounts([rootGroup], existingDiscounts)).not.toThrow()

    const result = mergeProductGroupDiscounts([rootGroup], existingDiscounts)

    expect(result[0]).toMatchObject({ DiscountRate: 9, ProductGroupId: 1 })
    expect(result[0].SubProductGroupDiscounts).toHaveLength(1)
    expect(result[0].SubProductGroupDiscounts?.[0]).toMatchObject({ ProductGroupId: 2 })
  })
})
