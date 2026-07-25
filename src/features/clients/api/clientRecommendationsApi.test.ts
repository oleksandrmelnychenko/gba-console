import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  getMostPurchasedProductsByClientId,
  RecommendationContractError,
} from './clientRecommendationsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('clientRecommendationsApi recommendation evidence', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it.each([
    ['repurchase', 'repurchase_history'],
    ['discovery', 'similar_clients'],
    ['discovery', 'copurchase'],
    ['discovery', 'global_popular'],
  ] as const)('preserves %s / %s metadata from the hydrated wrapper', async (
    source,
    sourceDetail,
  ) => {
    apiRequestMock.mockResolvedValueOnce([
      {
        Product: {
          Id: 18487,
          Name: 'Амортизатор',
          VendorCode: 'SEM18487',
        },
        Rank: 1,
        Score: 0.75,
        Source: source,
        SourceDetail: sourceDetail,
        SourceHistoryStart: '2025-01-01',
        EffectiveStart: '2025-01-01',
        HistoryComplete: true,
      },
    ])

    const result = await getMostPurchasedProductsByClientId(
      '397abefd-aa19-4b89-96a2-2015c40eeb26',
      false,
    )

    expect(result).toEqual([
      expect.objectContaining({
        Id: 18487,
        RecommendationRank: 1,
        RecommendationScore: 0.75,
        RecommendationSource: source,
        RecommendationSourceDetail: sourceDetail,
        RecommendationSourceHistoryStart: '2025-01-01',
        RecommendationEffectiveStart: '2025-01-01',
        RecommendationHistoryComplete: true,
      }),
    ])
  })

  it('fails closed when wrapper rows disagree on their history proof', async () => {
    const row = (effectiveStart: string) => ({
      Product: { Id: 18487 },
      Rank: 1,
      Score: 0.75,
      Source: 'repurchase',
      SourceDetail: 'repurchase_history',
      SourceHistoryStart: '2025-01-01',
      EffectiveStart: effectiveStart,
      HistoryComplete: true,
    })
    apiRequestMock.mockResolvedValueOnce([row('2025-01-01'), row('2025-02-01')])

    await expect(
      getMostPurchasedProductsByClientId(
        '397abefd-aa19-4b89-96a2-2015c40eeb26',
        false,
      ),
    ).rejects.toBeInstanceOf(RecommendationContractError)
  })
})
