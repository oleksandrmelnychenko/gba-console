export type CartReserveEntity = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type CartReserveCurrency = CartReserveEntity & {
  Code?: string
  Name?: string
}

export type CartReserveClient = CartReserveEntity & {
  FullName?: string
  Name?: string
}

export type CartReserveAgreement = CartReserveEntity & {
  Currency?: CartReserveCurrency
  Name?: string
}

export type CartReserveClientAgreement = CartReserveEntity & {
  Agreement?: CartReserveAgreement
  Client?: CartReserveClient
}

export type CartReserveProduct = CartReserveEntity & {
  MainOriginalNumber?: string
  Name?: string
  VendorCode?: string
}

export type CartReserveUser = CartReserveEntity & {
  LastName?: string
}

export type CartReserveAssignedSpecification = {
  SpecificationCode?: string
}

export type CartReserveOrderItem = CartReserveEntity & {
  AssignedSpecification?: CartReserveAssignedSpecification | null
  Comment?: string
  OverLordQty?: number
  Product?: CartReserveProduct
  Qty?: number
  TotalAmount?: number
  TotalAmountEurToUah?: number
  TotalAmountLocal?: number
  User?: CartReserveUser
}

export type ShoppingCartReserveItem = CartReserveEntity & {
  ClientAgreement?: CartReserveClientAgreement
  OrderItems?: CartReserveOrderItem[]
  TotalAmount?: number
  TotalLocalAmount?: number
  ValidUntil?: Date | string
}
