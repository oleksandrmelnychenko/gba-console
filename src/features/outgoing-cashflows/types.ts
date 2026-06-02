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
  OperationName?: string
  Number?: string
}

export type Currency = NamedEntity

export type Organization = NamedEntity

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
  Amount?: number
  AssignedIncomePaymentOrder?: AssignedIncomePaymentOrder | null
  AssignedOutcomePaymentOrder?: OutcomePaymentOrder | null
  Number?: string
  RootIncomePaymentOrder?: AssignedIncomePaymentOrder | null
  RootOutcomePaymentOrder?: OutcomePaymentOrder | null
}

export type ClientAgreement = EntityFields & {
  Client?: NamedEntity | null
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
  VAT?: number
  VatPercent?: number
}

export type ConsumablesOrder = EntityFields & {
  Comment?: string
  ConsumableProductOrganization?: NamedEntity | null
  ConsumablesOrderItems?: ConsumablesOrderItem[]
  ConsumablesStorage?: NamedEntity | null
  Number?: string
  OrganizationFromDate?: string
  OrganizationNumber?: string
  TotalAmount?: number
  TotalAmountWithoutVAT?: number
}

export type OutcomePaymentOrderConsumablesOrder = EntityFields & {
  ConsumablesOrder?: ConsumablesOrder | null
}

export type OutcomePaymentOrder = EntityFields & {
  AdvanceNumber?: string
  AfterExchangeAmount?: number
  Amount?: number
  Client?: NamedEntity | null
  ClientAgreement?: ClientAgreement | null
  ArrivalNumber?: string
  Colleague?: NamedEntity | null
  Comment?: string
  ConsumableProductOrganization?: NamedEntity | null
  CustomNumber?: string
  DifferenceAmount?: number
  EuroAmount?: number
  ExchangeRate?: number
  FromDate?: string
  IsAccounting?: boolean
  IsCanceled?: boolean
  IsManagementAccounting?: boolean
  IsUnderReport?: boolean
  IsUnderReportDone?: boolean
  Number?: string
  OperationTypeName?: string
  Organization?: Organization | null
  AssignedPaymentOrders?: AssignedPaymentOrder[]
  OutcomePaymentOrderConsumablesOrders?: OutcomePaymentOrderConsumablesOrder[]
  PaymentCurrencyRegister?: PaymentCurrencyRegister | null
  PaymentMovementOperation?: PaymentMovementOperation | null
  PaymentPurpose?: string
  RootAssignedPaymentOrder?: AssignedPaymentOrder | null
  TotalRowsQty?: number
  User?: NamedEntity | null
  VAT?: number
  VatPercent?: number
}

export type OutgoingCashflowsResponse = {
  Collection: OutcomePaymentOrder[]
  NegativeDifferenceAmount?: number
  PositiveDifferenceAmount?: number
  TotalRowsQty?: number
}

export type OutgoingCashflowRow = {
  amount?: number
  comment?: string
  currency?: string
  differenceAmount?: number
  fromDate?: string
  hasDocumentStructure?: boolean
  id: string
  isAccounting?: boolean
  isCanceled?: boolean
  isManagementAccounting?: boolean
  isUnderReport?: boolean
  number?: string
  operationType?: string
  order: OutcomePaymentOrder
  organization?: string
  payedTo?: string
  paymentMovement?: string
  paymentRegister?: string
  responsible?: string
  rootAssigned?: boolean
  totalRowsQty?: number
}

export type OutgoingCashflowsSearchParams = {
  currencyNetId?: string
  from: string
  limit: number
  offset: number
  organizationIds?: string[]
  paymentMovementNetId?: string
  registerNetId?: string
  to: string
  value?: string
}
