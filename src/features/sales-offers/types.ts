export const OFFER_PROCESSING_STATUS = {
  FullyProcessed: 2,
  NotProcessed: 0,
  PartiallyProcessed: 1,
} as const

export type OfferProcessingStatus = (typeof OFFER_PROCESSING_STATUS)[keyof typeof OFFER_PROCESSING_STATUS]

export type OfferReasonStatus = 'all' | 'none' | 'partial'

export type OffersFilters = {
  from: Date
  to: Date
}

export type OfferEntity = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
}

export type OfferUser = OfferEntity & {
  LastName?: string
}

export type OfferCurrency = OfferEntity & {
  Code?: string
}

export type OfferAgreement = OfferEntity & {
  Currency?: OfferCurrency
  Name?: string
}

export type OfferClient = OfferEntity & {
  FullName?: string
}

export type OfferClientAgreement = OfferEntity & {
  Agreement?: OfferAgreement
  Client?: OfferClient
}

export type OfferProduct = OfferEntity & {
  MainOriginalNumber?: string
  Name?: string
  VendorCode?: string
}

export type OfferOrderItem = OfferEntity & {
  Comment?: string
  OrderedQty?: number
  Product?: OfferProduct
  Qty?: number
  TotalAmount?: number
  User?: OfferUser
}

export type ClientShoppingCart = OfferEntity & {
  ClientAgreement?: OfferClientAgreement
  Comment?: string
  CreatedBy?: OfferUser
  IsOfferProcessed?: boolean
  Number?: string
  OfferProcessingStatus?: OfferProcessingStatus
  OrderItems?: OfferOrderItem[]
  TotalAmount?: number
  TotalLocalAmount?: number
  ValidUntil?: Date | string
}

export type OffersClientOption = OfferEntity & {
  FirstName?: string
  FullName?: string
  IsSubClient?: boolean
  IsTradePoint?: boolean
  LastName?: string
  MiddleName?: string
  Name?: string
}

export type OfferSubClientLink = OfferEntity & {
  RootClient?: OffersClientOption
  SubClient?: OffersClientOption
}

export type OffersProduct = OfferEntity & {
  MainOriginalNumber?: string
  Name?: string
  VendorCode?: string
}

export type OfferProductReservation = {
  AvailableQty?: number
  AvailableQtyUk?: number
  ProductNetUid?: string
}

export type OffersNewLine = {
  comment: string
  key: string
  product: OffersProduct
  qty: number
}
