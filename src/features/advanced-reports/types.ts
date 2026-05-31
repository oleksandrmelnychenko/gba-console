export type EntityFields = {
  Created?: string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: string
}

export type NamedEntity = EntityFields & {
  Code?: string
  FullName?: string
  LastName?: string
  Name?: string
  OperationName?: string
}

export type Currency = NamedEntity

export type PaymentMovement = EntityFields & {
  OperationName?: string
}

export type PaymentRegister = EntityFields & {
  Name?: string
}

export type PaymentCurrencyRegister = EntityFields & {
  Currency?: Currency | null
  PaymentRegister?: PaymentRegister | null
}

export type PaymentMovementOperation = EntityFields & {
  PaymentMovement?: PaymentMovement | null
}

export type ConsumableProduct = EntityFields & {
  Name?: string
  VendorCode?: string
}

export type ConsumablesOrderItem = EntityFields & {
  ConsumableProduct?: ConsumableProduct | null
  PricePerItem?: number
  Qty?: number
  TotalPrice?: number
  TotalPriceWithVAT?: number
}

export type ConsumablesOrder = EntityFields & {
  Comment?: string
  ConsumableProductOrganization?: NamedEntity | null
  ConsumablesOrderItems?: ConsumablesOrderItem[]
  ConsumablesStorage?: NamedEntity | null
  Number?: string
  TotalAmount?: number
}

export type OutcomePaymentOrderConsumablesOrder = EntityFields & {
  ConsumablesOrder?: ConsumablesOrder | null
}

export type OutcomePaymentOrder = EntityFields & {
  AdvanceNumber?: string
  Amount?: number
  Colleague?: (NamedEntity & { UserRole?: NamedEntity | null }) | null
  Comment?: string
  DifferenceAmount?: number
  FromDate?: string
  IsUnderReport?: boolean
  IsUnderReportDone?: boolean
  Organization?: NamedEntity | null
  OutcomePaymentOrderConsumablesOrders?: OutcomePaymentOrderConsumablesOrder[]
  PaymentCurrencyRegister?: PaymentCurrencyRegister | null
  PaymentMovementOperation?: PaymentMovementOperation | null
  RootAssignedPaymentOrder?: unknown
  User?: NamedEntity | null
}

export type AdvancedReportsResponse = {
  Collection: OutcomePaymentOrder[]
  NegativeDifferenceAmount?: number
  PositiveDifferenceAmount?: number
}

export type AdvancedReportRow = {
  amount?: number
  comment?: string
  currency?: string
  differenceAmount?: number
  fromDate?: string
  id: string
  isUnderReport?: boolean
  number?: string
  order: OutcomePaymentOrder
  organization?: string
  payedTo?: string
  paymentMovement?: string
  paymentRegister?: string
  responsible?: string
  role?: string
  rootAssigned?: boolean
  storage?: string
}

export type AdvancedReportsSearchParams = {
  currencyNetId?: string
  from: string
  limit: number
  offset: number
  paymentMovementNetId?: string
  registerNetId?: string
  to: string
  value?: string
}
