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
}

export type Currency = NamedEntity

export type Organization = NamedEntity

export type MeasureUnit = NamedEntity & {
  CodeOneC?: string
  Description?: string
}

export type ConsumableProductCategory = EntityFields & {
  ConsumableProducts?: ConsumableProduct[]
  Name?: string
}

export type ConsumableProduct = EntityFields & {
  ConsumableProductCategory?: ConsumableProductCategory | null
  MeasureUnit?: MeasureUnit | null
  Name?: string
  TotalQty?: number
  VendorCode?: string
}

export type PaymentCostMovement = EntityFields & {
  OperationName?: string
}

export type PaymentCostMovementOperation = EntityFields & {
  PaymentCostMovement?: PaymentCostMovement | null
}

export type PaymentMovement = EntityFields & {
  OperationName?: string
}

export type PaymentMovementOperation = EntityFields & {
  PaymentMovement?: PaymentMovement | null
}

export type PaymentCurrencyRegister = EntityFields & {
  Amount?: number
  Currency?: Currency | null
  IsSelected?: boolean
}

export type PaymentRegister = EntityFields & {
  Name?: string
  Organization?: Organization | null
  PaymentCurrencyRegisters?: PaymentCurrencyRegister[]
  Type?: number
}

export type SupplyOrganizationAgreement = EntityFields & {
  Currency?: Currency | null
  CurrentAmount?: number
  CurrentEuroAmount?: number
  ExistFrom?: string
  ExistTo?: string
  Name?: string
  Number?: string
  Organization?: Organization | null
  SupplyOrganizationDocuments?: ConsumablesOrderDocument[]
  SupplyOrganization?: NamedEntity | null
}

export type ConsumablesStorage = NamedEntity

export type SupplyOrganization = NamedEntity & {
  SupplyOrganizationAgreements?: SupplyOrganizationAgreement[]
}

export type User = NamedEntity

export type SupplyPaymentTask = EntityFields & {
  Comment?: string
  IsAccounting?: boolean
  IsAvailableForPayment?: boolean
  IsPayed?: boolean
  PayToDate?: string
  User?: User | null
}

export type ConsumablesOrderDocument = EntityFields & {
  ContentType?: string
  DocumentUrl?: string
  DocumentURL?: string
  FileName?: string
  Name?: string
  PdfDocumentUrl?: string
  PdfDocumentURL?: string
  Url?: string
  URL?: string
  url?: string
}

export type OutcomePaymentOrder = EntityFields & {
  AdvanceNumber?: string
  Amount?: number
  Colleague?: NamedEntity | null
  Comment?: string
  DifferenceAmount?: number
  FromDate?: string
  IsCanceled?: boolean
  IsUnderReport?: boolean
  IsUnderReportDone?: boolean
  Number?: string
  Organization?: Organization | null
  OutcomePaymentOrderConsumablesOrders?: OutcomePaymentOrderConsumablesOrder[]
  PaymentCurrencyRegister?: PaymentCurrencyRegister | null
  PaymentMovementOperation?: PaymentMovementOperation | null
  PaymentRegister?: PaymentRegister | null
  User?: NamedEntity | null
}

export type OutcomePaymentOrderConsumablesOrder = EntityFields & {
  ConsumablesOrder?: ConsumablesOrder | null
  ConsumablesOrderId?: number
  OutcomePaymentOrder?: OutcomePaymentOrder | null
}

export type ConsumablesOrderItem = EntityFields & {
  ConsumableProduct?: ConsumableProduct | null
  ConsumableProductCategory?: ConsumableProductCategory | null
  IsService?: boolean
  PaymentCostMovementOperation?: PaymentCostMovementOperation | null
  PricePerItem?: number
  Qty?: number
  SupplyOrganizationAgreement?: SupplyOrganizationAgreement | null
  TotalPrice?: number
  TotalPriceWithVAT?: number
  VAT?: number
  VatPercent?: number
}

export type ConsumablesOrder = EntityFields & {
  Comment?: string
  ConsumableProductOrganization?: NamedEntity | null
  ConsumablesOrderDocuments?: ConsumablesOrderDocument[]
  ConsumablesOrderItems?: ConsumablesOrderItem[]
  ConsumablesStorage?: ConsumablesStorage | null
  IsDone?: boolean
  IsPayed?: boolean
  Number?: string
  OrganizationFromDate?: string
  OrganizationNumber?: string
  OutcomePaymentOrderConsumablesOrders?: OutcomePaymentOrderConsumablesOrder[]
  SupplyPaymentTask?: SupplyPaymentTask | null
  SupplyOrganizationAgreement?: SupplyOrganizationAgreement | null
  TotalAmount?: number
  TotalAmountWithoutVAT?: number
  User?: NamedEntity | null
}

export type ConsumableOrderRow = {
  amount?: number
  comment?: string
  created?: string
  currency?: string
  id: string
  isDone?: boolean
  isPayed?: boolean
  itemCount: number
  order: ConsumablesOrder
  organization?: string
  organizationFromDate?: string
  organizationNumber?: string
  responsible?: string
  serviceOrganization?: string
  storage?: string
  totalAmountWithoutVat?: number
}

export type ConsumableOrdersSearchParams = {
  from: string
  to: string
}

export type ConsumableOrderCalculation = {
  Collection: ConsumablesOrder[]
  Total?: number
}
