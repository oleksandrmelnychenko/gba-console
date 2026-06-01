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
  Type?: number
}

export type PaymentCurrencyRegister = EntityFields & {
  Currency?: Currency | null
  PaymentRegister?: PaymentRegister | null
}

export type PaymentMovementOperation = EntityFields & {
  PaymentMovement?: PaymentMovement | null
}

export type AssignedIncomePaymentOrder = EntityFields & {
  Amount?: number
  Colleague?: NamedEntity | null
  Currency?: Currency | null
  FromDate?: string
  Number?: string
  PaymentRegister?: PaymentRegister | null
}

export type AssignedPaymentOrder = EntityFields & {
  AssignedIncomePaymentOrder?: AssignedIncomePaymentOrder | null
  AssignedOutcomePaymentOrder?: OutcomePaymentOrder | null
  RootIncomePaymentOrder?: AssignedIncomePaymentOrder | null
  RootOutcomePaymentOrder?: OutcomePaymentOrder | null
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
  AssignedPaymentOrders?: AssignedPaymentOrder[]
  OutcomePaymentOrderConsumablesOrders?: OutcomePaymentOrderConsumablesOrder[]
  PaymentCurrencyRegister?: PaymentCurrencyRegister | null
  PaymentMovementOperation?: PaymentMovementOperation | null
  RootAssignedPaymentOrder?: AssignedPaymentOrder | null
  TotalRowsQty?: number
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
  hasDocumentStructure?: boolean
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
