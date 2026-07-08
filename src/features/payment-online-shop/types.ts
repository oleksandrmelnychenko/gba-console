export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type NamedEntity = EntityFields & {
  Code?: string
  Name?: string
}

export const RetailPaymentStatusType = {
  New: 0,
  Confirmed: 1,
  ChangedToInvoice: 2,
  PartialPaid: 3,
  Paid: 4,
} as const

export type RetailPaymentStatusTypeValue =
  (typeof RetailPaymentStatusType)[keyof typeof RetailPaymentStatusType]

export const PaymentType = {
  Prepayment: 0,
  CashOnDelivery: 1,
} as const

export type PaymentTypeValue = (typeof PaymentType)[keyof typeof PaymentType]

export type PaymentShopUser = EntityFields & {
  FirstName?: string
  LastName?: string
  MiddleName?: string
  FullName?: string
  Name?: string
}

export type PaymentShopRetailClient = EntityFields & {
  Name?: string
  PhoneNumber?: string
}

export type PaymentShopProduct = EntityFields & {
  MainOriginalNumber?: string
  Name?: string
  VendorCode?: string
}

export type PaymentShopOrderItem = EntityFields & {
  Product?: PaymentShopProduct | null
  Qty?: number
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalVat?: number
}

export type PaymentShopOrder = EntityFields & {
  OrderItems?: PaymentShopOrderItem[]
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalVat?: number
}

export type PaymentShopCurrency = NamedEntity

export type PaymentShopOrganization = NamedEntity

export type PaymentShopAgreement = EntityFields & {
  Name?: string
  Currency?: PaymentShopCurrency | null
  Organization?: PaymentShopOrganization | null
}

export type PaymentShopClientAgreement = EntityFields & {
  Agreement?: PaymentShopAgreement | null
}

export type PaymentShopSaleNumber = EntityFields & {
  Value?: string
}

export type PaymentShopSale = EntityFields & {
  ChangedToInvoice?: Date | string | null
  ClientAgreement?: PaymentShopClientAgreement | null
  ClientAgreementId?: number
  IsFullPayment?: boolean
  Order?: PaymentShopOrder | null
  SaleNumber?: PaymentShopSaleNumber | null
}

export type RetailPaymentStatus = EntityFields & {
  Amount?: number
  AmountToPay?: number
  PaidAmount?: number
  RetailPaymentStatusType?: RetailPaymentStatusTypeValue
}

export type RetailClientPaymentImageItem = EntityFields & {
  Amount?: number
  Comment?: string
  ImgUrl?: string
  IsLocked?: boolean
  PaymentType?: PaymentTypeValue | number
  RetailClientPaymentImageId?: number
  User?: PaymentShopUser | null
}

export type PaymentShopItem = EntityFields & {
  RetailClient?: PaymentShopRetailClient | null
  RetailClientId?: string
  RetailClientPaymentImageItems?: RetailClientPaymentImageItem[]
  RetailPaymentStatus?: RetailPaymentStatus | null
  Sale?: PaymentShopSale | null
  SaleId?: number
}

export type PaymentShopItemsResponse = {
  items: PaymentShopItem[]
  totalRowsQty?: number
}

export type PaymentShopFilters = {
  limit?: number
  offset?: number
  saleDateFrom: string
  saleDateTo: string
  saleNumber: string
  phoneNumber: string
}

export type AddPaymentImagePayload = {
  amount: number
  comment: string
  image: File
  paymentImageId: number
  paymentType: PaymentTypeValue | number
  user: PaymentShopUser | null
}

export type EditPaymentImagePayload = {
  amount: number
  comment: string
  item: RetailClientPaymentImageItem
  paymentImageId: number
  user: PaymentShopUser | null
}
