import { describe, expect, it } from 'vitest'
import { applyPendingDiscountDraft } from './pendingDiscountDraft'
import type { Client } from '../../types'
import type { DiscountsTreeDraft } from './DiscountsTree'

describe('applyPendingDiscountDraft', () => {
  it('merges dirty discount draft into the matching client agreement only', () => {
    const client: Client = {
      ClientAgreements: [
        {
          Agreement: { NetUid: 'agreement-1' },
          ProductGroupDiscounts: [{ DiscountRate: 5, ProductGroupId: 1 }],
        },
        {
          Agreement: { NetUid: 'agreement-2' },
          ProductGroupDiscounts: [{ DiscountRate: 7, ProductGroupId: 2 }],
        },
      ],
    }
    const draft: DiscountsTreeDraft = {
      clientAgreementNetId: 'agreement-1',
      isDirty: true,
      productGroupDiscounts: [{ DiscountRate: 12, ProductGroupId: 1 }],
    }

    expect(applyPendingDiscountDraft(client, draft).ClientAgreements).toEqual([
      {
        Agreement: { NetUid: 'agreement-1' },
        ProductGroupDiscounts: [{ DiscountRate: 12, ProductGroupId: 1 }],
        __ProductGroupDiscountsChanged: true,
      },
      {
        Agreement: { NetUid: 'agreement-2' },
        ProductGroupDiscounts: [{ DiscountRate: 7, ProductGroupId: 2 }],
      },
    ])
  })

  it('leaves the client unchanged when there is no dirty draft', () => {
    const client: Client = { ClientAgreements: [{ Agreement: { NetUid: 'agreement-1' } }] }

    expect(applyPendingDiscountDraft(client, null)).toBe(client)
    expect(applyPendingDiscountDraft(client, { clientAgreementNetId: 'agreement-1', isDirty: false, productGroupDiscounts: [] })).toBe(client)
  })

  it('returns agreements unchanged when the draft matches no agreement', () => {
    const client: Client = {
      ClientAgreements: [{ Agreement: { NetUid: 'agreement-1' }, ProductGroupDiscounts: [{ DiscountRate: 5, ProductGroupId: 1 }] }],
    }
    const draft: DiscountsTreeDraft = {
      clientAgreementNetId: 'no-match',
      isDirty: true,
      productGroupDiscounts: [{ DiscountRate: 99, ProductGroupId: 1 }],
    }

    const result = applyPendingDiscountDraft(client, draft)

    expect(result.ClientAgreements).toEqual([
      { Agreement: { NetUid: 'agreement-1' }, ProductGroupDiscounts: [{ DiscountRate: 5, ProductGroupId: 1 }] },
    ])
    expect(result.ClientAgreements?.[0]).not.toHaveProperty('__ProductGroupDiscountsChanged')
  })
})
