export type EntityFields = {
  Created?: string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: string
}

export type NamedEntity = EntityFields & {
  Code?: string
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
  Number?: string
  OperationName?: string
  VendorCode?: string
}

export type Currency = NamedEntity

export type PaymentRegister = EntityFields & {
  Name?: string
  Type?: number
}

export type PaymentCurrencyRegister = EntityFields & {
  Currency?: Currency | null
  PaymentRegister?: PaymentRegister | null
}

export type PaymentMovement = EntityFields & {
  OperationName?: string
}

export type PaymentMovementOperation = EntityFields & {
  PaymentMovement?: PaymentMovement | null
}

export type OutcomePaymentOrder = EntityFields & {
  AdvanceNumber?: string
  Amount?: number
  Colleague?: NamedEntity | null
  Comment?: string
  CustomNumber?: string
  FromDate?: string
  IsUnderReport?: boolean
  IsUnderReportDone?: boolean
  Number?: string
  Organization?: NamedEntity | null
  PaymentCurrencyRegister?: PaymentCurrencyRegister | null
  PaymentMovementOperation?: PaymentMovementOperation | null
  PaymentPurpose?: string
}

export type OutcomePaymentOrderConsumablesOrder = EntityFields & {
  ConsumablesOrderId?: number
  OutcomePaymentOrder?: OutcomePaymentOrder | null
}

export type ConsumableProduct = EntityFields & {
  Name?: string
  VendorCode?: string
}

export type ConsumablesOrderItem = EntityFields & {
  ConsumableProduct?: ConsumableProduct | null
  IsService?: boolean
  PricePerItem?: number
  Qty?: number
  TotalPrice?: number
  TotalPriceWithVAT?: number
  VAT?: number
  VatPercent?: number
}

export type ConsumablesOrder = EntityFields & {
  Comment?: string
  ConsumablesOrderItems?: ConsumablesOrderItem[]
  IsDone?: boolean
  IsPayed?: boolean
  Number?: string
  OrganizationFromDate?: string
  OrganizationNumber?: string
  OutcomePaymentOrderConsumablesOrders?: OutcomePaymentOrderConsumablesOrder[]
  TotalAmount?: number
  TotalAmountWithoutVAT?: number
  User?: NamedEntity | null
}

export type AccountableExpenseRow = {
  advanceNumber?: string
  amount?: number
  comment?: string
  created?: string
  currency?: string
  id: string
  isPayed?: boolean
  item: ConsumablesOrderItem
  order: ConsumablesOrder
  organization?: string
  payedTo?: string
  pricePerItem?: number
  productName?: string
  qty?: number
  responsible?: string
  vendorCode?: string
}

export type AccountableExpensesSearchParams = {
  from: string
  to: string
}
