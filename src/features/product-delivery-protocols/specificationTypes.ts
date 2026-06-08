import type { EntityFields } from './types'

export type ProductMeasureUnit = EntityFields & {
  Name?: string
}

export type ProductSpecificationUser = EntityFields & {
  FirstName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
}

export type ProductSpecificationEntity = EntityFields & {
  AddedBy?: ProductSpecificationUser | null
  Created?: Date | string
  CustomsValue?: number
  Duty?: number
  DutyPercent?: number
  ProductId?: number
  SpecificationCode?: string
  VATPercent?: number
  VATValue?: number
}

export type SpecificationProduct = EntityFields & {
  MeasureUnit?: ProductMeasureUnit | null
  Name?: string
  ProductSpecifications?: ProductSpecificationEntity[]
  VendorCode?: string
}

export type SpecificationSupplyInvoiceOrderItem = EntityFields & {
  Product?: SpecificationProduct | null
}

export type SpecificationSupplyServiceSource = EntityFields & {
  ConsumableProduct?: { Name?: string } | null
  ContainerOrganization?: { Name?: string } | null
  SupplyOrganization?: { Name?: string } | null
  VehicleOrganization?: { Name?: string } | null
}

export type PackingListPackageOrderItemSupplyService = EntityFields & {
  BillOfLadingService?: SpecificationSupplyServiceSource | null
  ContainerService?: SpecificationSupplyServiceSource | null
  GeneralValue?: number
  GeneralValueEur?: number
  GeneralValueUah?: number
  ManagementValue?: number
  ManagementValueEur?: number
  ManagementValueUah?: number
  MergedService?: SpecificationSupplyServiceSource | null
  Name?: string
  NetValue?: number
  NetValueEur?: number
  NetValueUah?: number
  TotalGeneralPriceForServiceEur?: number
  TotalGeneralPriceForServiceUah?: number
  TotalManagementPriceForServiceEur?: number
  TotalManagementPriceForServiceUah?: number
  TotalNetPriceForServiceEur?: number
  TotalNetPriceForServiceUah?: number
  VehicleService?: SpecificationSupplyServiceSource | null
}

export type PackingListPackageOrderItem = EntityFields & {
  AccountingTotalGrossPrice?: number
  AccountingTotalGrossPriceEur?: number
  DeliveryAmountEur?: number
  DeliveryAmountUah?: number
  PackingListPackageOrderItemSupplyServices?: PackingListPackageOrderItemSupplyService[]
  ProductIsImported?: boolean
  Qty?: number
  SupplyInvoiceOrderItem?: SpecificationSupplyInvoiceOrderItem | null
  TotalGrossPrice?: number
  TotalGrossPriceEur?: number
  TotalGrossWeight?: number
  TotalNetPrice?: number
  TotalNetWeight?: number
  UnitPrice?: number
}

export type SpecificationCurrency = EntityFields & {
  Code?: string
}

export type SpecificationSupplyOrderAgreement = {
  Agreement?: {
    Currency?: SpecificationCurrency | null
  } | null
}

export type SpecificationSupplyOrderClient = EntityFields & {
  FullName?: string
  Name?: string
}

export type SpecificationSupplyOrganizationAgreement = EntityFields & {
  Currency?: SpecificationCurrency | null
  Name?: string
  Number?: string
}

export type SpecificationSupplyOrganization = EntityFields & {
  Name?: string
  SupplyOrganizationAgreements?: SpecificationSupplyOrganizationAgreement[]
}

export type SpecificationSupplyOrder = EntityFields & {
  Client?: SpecificationSupplyOrderClient | null
  ClientAgreement?: SpecificationSupplyOrderAgreement | null
}

export type SpecificationPackingList = EntityFields & {
  AccountingTotalGrossPrice?: number
  AccountingTotalGrossPriceEur?: number
  FromDate?: Date | string
  InvNo?: string
  MergedPackingLists?: SpecificationPackingList[]
  No?: string
  PackingListPackageOrderItems?: PackingListPackageOrderItem[]
  TotalCustomValue?: number
  TotalDuty?: number
  TotalGrossPrice?: number
  TotalGrossPriceEur?: number
  TotalGrossWeight?: number
  TotalNetPrice?: number
  TotalNetWeight?: number
  TotalQuantity?: number
  TotalVatAmount?: number
}

export type SupplyInvoiceDeliveryDocument = EntityFields & {
  ContentType?: string
  Deleted?: boolean
  DocumentUrl?: string
  FileName?: string
}

export type SpecificationSupplyInvoice = EntityFields & {
  DateCustomDeclaration?: Date | string | null
  DateFrom?: Date | string
  DeliveryAmount?: number
  MergedSupplyInvoices?: SpecificationSupplyInvoice[]
  Number?: string
  NumberCustomDeclaration?: string
  PackingLists?: SpecificationPackingList[]
  SupplyOrganization?: SpecificationSupplyOrganization | null
  SupplyOrganizationAgreement?: SpecificationSupplyOrganizationAgreement | null
  SupplyInvoiceDeliveryDocuments?: SupplyInvoiceDeliveryDocument[]
  SupplyOrder?: SpecificationSupplyOrder | null
  TotalGrossPrice?: number
  TotalGrossWeight?: number
  TotalNetPrice?: number
  TotalNetWeight?: number
}

export type SpecificationProtocol = EntityFields & {
  DeliveryProductProtocolNumber?: { Number?: string } | null
  IsCompleted?: boolean
  IsPartiallyPlaced?: boolean
  IsPlaced?: boolean
  IsShipped?: boolean
  SupplyInvoices?: SpecificationSupplyInvoice[]
}

export type ProductSpecificationParseConfiguration = {
  CustomsValue: number
  Duty: number
  EndRow: number
  Price: number
  Qty: number
  SpecificationCode: number
  StartRow: number
  VATValue: number
  VendorCode: number
}

export type UploadProductSpecificationResult = {
  MissingProducts?: string[]
  SuccessfullyUpdatedProducts?: string[]
  UpdateNotRequiredProducts?: string[]
}

export type SpecificationDownloadDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export type DeliveryDocumentDraft = {
  contentType: string
  deleted: boolean
  documentUrl: string
  file: File | null
  fileName: string
  id: number
}
