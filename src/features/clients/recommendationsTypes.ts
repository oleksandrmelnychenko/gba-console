export type RecommendationSource = 'discovery' | 'repurchase'

export type RecommendationSourceDetail =
  | 'copurchase'
  | 'global_popular'
  | 'repurchase_history'
  | 'similar_clients'

export type RecommendationProduct = {
  Id?: number
  NetUid?: string
  VendorCode?: string
  Name?: string
  NameUA?: string
  Description?: string
  DescriptionUA?: string
  MainOriginalNumber?: string
  Size?: string
  Image?: string
  HasImage?: boolean
  IsSelected?: boolean
  AvailableQtyUk?: number
  AvailableQtyUkVAT?: number
  AvailableQtyUkReSale?: number
  CurrentPrice?: number
  CurrentPriceEurToUah?: number
  RecommendationRank?: number
  RecommendationScore?: number
  RecommendationSource?: RecommendationSource
  RecommendationSourceDetail?: RecommendationSourceDetail
  RecommendationSourceHistoryStart?: string
  RecommendationEffectiveStart?: string
  RecommendationHistoryComplete?: boolean
}
