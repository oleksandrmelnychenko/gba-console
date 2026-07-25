import type {
  RecommendationProduct,
  RecommendationSourceDetail,
} from '../../recommendationsTypes'

export type RecommendationSourcePresentation = {
  color: string
  label: string
  tooltip: string
}

const SOURCE_PRESENTATIONS: Record<
  RecommendationSourceDetail,
  RecommendationSourcePresentation
> = {
  repurchase_history: {
    color: 'blue',
    label: 'Повторна закупівля',
    tooltip: 'Клієнт уже купував цей товар',
  },
  similar_clients: {
    color: 'grape',
    label: 'Нове для клієнта',
    tooltip: 'Рекомендовано за покупками схожих клієнтів; цей клієнт товар ще не купував',
  },
  copurchase: {
    color: 'cyan',
    label: 'Часто купують разом',
    tooltip: 'Товар часто купують разом із товарами, що стали основою цієї рекомендації',
  },
  global_popular: {
    color: 'orange',
    label: 'Популярний товар',
    tooltip: 'Популярний товар у загальних продажах; це не доказ покупок схожих клієнтів',
  },
}

export function getRecommendationSourcePresentation(
  product: RecommendationProduct,
): RecommendationSourcePresentation | null {
  const sourceDetail = product.RecommendationSourceDetail

  if (!sourceDetail) {
    return null
  }

  return SOURCE_PRESENTATIONS[sourceDetail] ?? null
}
