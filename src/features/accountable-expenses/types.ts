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
  DifferenceAmount?: number
  FromDate?: string
  IsUnderReport?: boolean
  IsUnderReportDone?: boolean
  Number?: string
  Organization?: NamedEntity | null
  OutcomePaymentOrderConsumablesOrders?: OutcomePaymentOrderConsumablesOrder[]
  PaymentCurrencyRegister?: PaymentCurrencyRegister | null
  PaymentMovementOperation?: PaymentMovementOperation | null
  PaymentPurpose?: string
  User?: NamedEntity | null
}

export type OutcomePaymentOrderConsumablesOrder = EntityFields & {
  ConsumablesOrder?: ConsumablesOrder | null
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
  TotalPaidAmount?: number
  TotalRowQty?: number
  TotalRowsQty?: number
  User?: NamedEntity | null
}

export type AccountableExpensePaymentStatus = 'paid' | 'partial' | 'unpaid'

export type AccountableExpenseUnderReportStatus = 'closed' | 'mixed' | 'none' | 'open'

export type AccountableExpenseRow = {
  advanceNumber?: string
  amount?: number
  comment?: string
  created?: string
  currency?: string
  id: string
  isPayed?: boolean
  isUnderReportDone?: boolean
  item: ConsumablesOrderItem
  order: ConsumablesOrder
  organization?: string
  payedTo?: string
  paidAmount?: number
  paymentStatus?: AccountableExpensePaymentStatus
  pricePerItem?: number
  productName?: string
  qty?: number
  responsible?: string
  underReportStatus?: AccountableExpenseUnderReportStatus
  vendorCode?: string
}

export type AccountableExpensesSearchParams = {
  from: string
  limit: number
  offset: number
  to: string
}

export type AccountableExpensesResponse = {
  Items: ConsumablesOrder[]
  Total?: number
}
