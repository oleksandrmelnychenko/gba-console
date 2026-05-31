export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type Currency = EntityFields & {
  Code?: string
  Name?: string
}

export type ProtocolUser = EntityFields & {
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
}

export type SupplyOrganizationAgreement = EntityFields & {
  Currency?: Currency | null
  Name?: string
  Number?: string
}

export type SupplyOrganization = EntityFields & {
  Name?: string
  SupplyOrganizationAgreements?: SupplyOrganizationAgreement[]
}

export type ConsumableProduct = EntityFields & {
  Name?: string
}

export type SupplyDocument = EntityFields & {
  ContentType?: string
  DocumentUrl?: string
  FileName?: string
}

export type SupplyPaymentTask = EntityFields & {
  Comment?: string
  GrossPrice?: number
  IsAccounting?: boolean
  PayToDate?: Date | string
  User?: ProtocolUser | null
}

export type SupplyInformationTask = EntityFields & {
  Comment?: string
  FromDate?: Date | string
  GrossPrice?: number
  User?: ProtocolUser | null
}

export type ActProvidingService = EntityFields

export type MergedService = EntityFields & {
  AccountingActProvidingService?: ActProvidingService | null
  AccountingExchangeRate?: number
  AccountingGrossPrice?: number
  AccountingNetPrice?: number
  AccountingPaymentTask?: SupplyPaymentTask | null
  AccountingSupplyCostsWithinCountry?: number
  AccountingVat?: number
  AccountingVatPercent?: number
  ActProvidingService?: ActProvidingService | null
  ActProvidingServiceDocument?: SupplyDocument | null
  ConsumableProduct?: ConsumableProduct | null
  ExchangeRate?: number
  FromDate?: Date | string
  GrossPrice?: number
  InvoiceDocuments?: SupplyDocument[]
  IsIncludeAccountingValue?: boolean
  Name?: string
  NetPrice?: number
  Number?: string
  ServiceNumber?: string
  SupplyInformationTask?: SupplyInformationTask | null
  SupplyOrganization?: SupplyOrganization | null
  SupplyOrganizationAgreement?: SupplyOrganizationAgreement | null
  SupplyPaymentTask?: SupplyPaymentTask | null
  SupplyServiceAccountDocument?: SupplyDocument | null
  User?: ProtocolUser | null
  Vat?: number
  VatPercent?: number
}

export type SupplyOrderUkrainePaymentDeliveryProtocolKey = EntityFields & {
  Key?: string
}

export type SupplyOrderUkrainePaymentDeliveryProtocol = EntityFields & {
  IsAccounting?: boolean
  SupplyOrderUkrainePaymentDeliveryProtocolKey?: SupplyOrderUkrainePaymentDeliveryProtocolKey | null
  SupplyPaymentTask?: SupplyPaymentTask | null
  User?: ProtocolUser | null
  Value?: number
}

export type SupplyOrderUkraine = EntityFields & {
  MergedServices?: MergedService[]
  Number?: string
  SupplyOrderUkrainePaymentDeliveryProtocols?: SupplyOrderUkrainePaymentDeliveryProtocol[]
}

export type NewMergedServiceFormValues = {
  accountDocuments: File[]
  accountingExchangeRate: string
  agreement: SupplyOrganizationAgreement | null
  comment: string
  consumableProduct: ConsumableProduct | null
  createAccountingTask: boolean
  createTask: boolean
  exchangeRate: string
  files: File[]
  fromDate: Date | null
  grossPrice: string
  grossPriceAccounting: string
  invoiceNumber: string
  isIncludeAccountingValue: boolean
  isSupplyInformationTask: boolean
  name: string
  payToDate: Date | null
  percent: string
  percentAccounting: string
  responsibleForPayment: ProtocolUser | null
  supplyInformationTaskComment: string
  supplyInformationTaskGrossPrice: string
  supplyOrganization: SupplyOrganization | null
}

export type NewPaymentProtocolFormValues = {
  comment: string
  isAccounting: boolean
  payToDate: Date | null
  protocolKey: SupplyOrderUkrainePaymentDeliveryProtocolKey | null
  responsible: ProtocolUser | null
  value: string
}
