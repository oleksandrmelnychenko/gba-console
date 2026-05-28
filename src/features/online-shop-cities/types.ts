export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type OnlineShopCity = EntityFields & {
  IsLocalPayment?: boolean
  NameRu?: string
  NameUa?: string
}
