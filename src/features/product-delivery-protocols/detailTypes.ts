import type {
  EntityFields,
  ProtocolOrganization,
  ProtocolUser,
  SupplyTransportationType,
} from './types'

export const SupplyExtraChargeType = {
  Price: 0,
  Weight: 1,
  Volume: 2,
} as const

export type SupplyExtraChargeType = (typeof SupplyExtraChargeType)[keyof typeof SupplyExtraChargeType]

export type Currency = EntityFields & {
  Code?: string
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
  Deleted?: boolean
  DocumentUrl?: string
  FileName?: string
}

export type SupplyPaymentTaskDocument = SupplyDocument

export type SupplyPaymentTask = EntityFields & {
  Comment?: string
  Deleted?: boolean
  GrossPrice?: number
  PayToDate?: Date | string
  SupplyPaymentTaskDocuments?: SupplyPaymentTaskDocument[]
  User?: ProtocolUser | null
}

export type SupplyInformationTask = EntityFields & {
  Comment?: string
  FromDate?: Date | string
  GrossPrice?: number
  User?: ProtocolUser | null
}

export type ActProvidingService = EntityFields

export type SupplyOrderClient = EntityFields & {
  FullName?: string
  Name?: string
}

export type SupplyOrderAgreement = {
  Agreement?: {
    Currency?: Currency | null
  } | null
}

export type SupplyOrder = EntityFields & {
  Client?: SupplyOrderClient | null
  ClientAgreement?: SupplyOrderAgreement | null
}

export type SupplyInvoice = EntityFields & {
  AccountingTotalSpending?: number
  DateCustomDeclaration?: Date | string | null
  DateFrom?: Date | string
  DeliveryAmount?: number
  DiscountAmount?: number
  ExchangeRate?: number
  ExchangeRateEurToUah?: number
  MergedSupplyInvoices?: SupplyInvoice[]
  Number?: string
  NumberCustomDeclaration?: string
  ServiceNumber?: string
  SupplyInvoiceBillOfLadingServices?: SupplyInvoiceBillOfLadingService[]
  SupplyInvoiceDeliveryDocuments?: SupplyDocument[]
  SupplyInvoiceMergedServices?: SupplyInvoiceMergedService[]
  SupplyOrder?: SupplyOrder | null
  TotalNetPrice?: number
  TotalSpending?: number
}

export type BillOfLadingService = EntityFields & {
  SupplyOrganization?: SupplyOrganization | null
  SupplyOrganizationAgreement?: SupplyOrganizationAgreement | null
}

export type SupplyInvoiceBillOfLadingService = EntityFields & {
  AccountingValue?: number
  BillOfLadingService?: BillOfLadingService | null
  IsCalculatedValue?: boolean
  Value?: number
}

export type SupplyInvoiceMergedService = EntityFields & {
  AccountingValue?: number
  ExchangeRateEurToAgreementCurrency?: number
  ExchangeRateEurToUah?: number
  IsCalculatedValue?: boolean
  MergedService?: MergedService | null
  SupplyInvoice?: SupplyInvoice | null
  Value?: number
}

export type MergedService = EntityFields & {
  AccountingActProvidingService?: ActProvidingService | null
  AccountingGrossPrice?: number
  AccountingNetPrice?: number
  AccountingPaymentTask?: SupplyPaymentTask | null
  AccountingSupplyCostsWithinCountry?: number
  AccountingVat?: number
  AccountingVatPercent?: number
  AccountingExchangeRate?: number
  ActProvidingService?: ActProvidingService | null
  ActProvidingServiceDocument?: SupplyDocument | null
  ConsumableProduct?: ConsumableProduct | null
  ExchangeRate?: number
  FromDate?: Date | string
  GrossPrice?: number
  InvoiceDocuments?: SupplyDocument[]
  IsAutoCalculatedValue?: boolean
  IsCalculatedValue?: boolean
  IsIncludeAccountingValue?: boolean
  Name?: string
  NetPrice?: number
  Number?: string
  ServiceNumber?: string
  SupplyExtraChargeType?: SupplyExtraChargeType
  SupplyInformationTask?: SupplyInformationTask | null
  SupplyInvoiceMergedServices?: SupplyInvoiceMergedService[]
  SupplyOrganization?: SupplyOrganization | null
  SupplyOrganizationAgreement?: SupplyOrganizationAgreement | null
  SupplyPaymentTask?: SupplyPaymentTask | null
  SupplyServiceAccountDocument?: SupplyDocument | null
  User?: ProtocolUser | null
  Vat?: number
  VatPercent?: number
}

export type ProtocolDetail = EntityFields & {
  Comment?: string
  DeliveryProductProtocolNumber?: { Number?: string } | null
  FromDate?: Date | string
  IsCompleted?: boolean
  IsShipped?: boolean
  MergedServices?: MergedService[]
  Organization?: ProtocolOrganization | null
  SupplyInvoices?: SupplyInvoice[]
  TransportationType?: SupplyTransportationType
  User?: ProtocolUser | null
}

export type NewMergedServiceFormValues = {
  accountDocuments: File[]
  accountingExchangeRate: string
  accountingTaskComment: string
  accountingTaskFiles: File[]
  accountingTaskPayToDate: Date | null
  actDocuments: File[]
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
  supplyInformationTaskComment: string
  supplyInformationTaskGrossPrice: string
  supplyInformationTaskUser: ProtocolUser | null
  supplyOrganization: SupplyOrganization | null
  taskComment: string
  taskFiles: File[]
  taskPayToDate: Date | null
  taskUser: ProtocolUser | null
  accountingTaskUser: ProtocolUser | null
}

export type CalculateMergedServiceInvoiceItem = {
  accountingValue: string
  entity: SupplyInvoiceMergedService
  isSelected: boolean
  number: string
  value: string
}
