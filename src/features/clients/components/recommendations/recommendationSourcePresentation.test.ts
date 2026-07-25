import { describe, expect, it } from 'vitest'
import type { RecommendationProduct } from '../../recommendationsTypes'
import { getRecommendationSourcePresentation } from './recommendationSourcePresentation'

describe('getRecommendationSourcePresentation', () => {
  it.each([
    [
      'repurchase_history',
      'Повторна закупівля',
      'Клієнт уже купував цей товар',
    ],
    [
      'similar_clients',
      'Нове для клієнта',
      'Рекомендовано за покупками схожих клієнтів; цей клієнт товар ще не купував',
    ],
    [
      'copurchase',
      'Часто купують разом',
      'Товар часто купують разом із товарами, що стали основою цієї рекомендації',
    ],
    [
      'global_popular',
      'Популярний товар',
      'Популярний товар у загальних продажах; це не доказ покупок схожих клієнтів',
    ],
  ] as const)('renders truthful %s evidence', (sourceDetail, label, tooltip) => {
    const product: RecommendationProduct = {
      RecommendationSourceDetail: sourceDetail,
    }

    expect(getRecommendationSourcePresentation(product)).toMatchObject({
      label,
      tooltip,
    })
  })

  it('does not infer evidence from the broad legacy source', () => {
    expect(getRecommendationSourcePresentation({
      RecommendationSource: 'discovery',
    })).toBeNull()
  })
})
