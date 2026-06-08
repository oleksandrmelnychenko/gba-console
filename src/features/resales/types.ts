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
  NameUA?: string
  Value?: string
  VendorCode?: string
}

export type ResaleCurrency = NamedEntity

export type ResaleOrganization = NamedEntity
  & {
    Address?: string
  }

export type ResaleAgreement = NamedEntity & {
  Currency?: ResaleCurrency | null
  ForReSale?: boolean
  FullName?: string
  Organization?: ResaleOrganization | null
  OrganizationId?: number
}

export type ResaleClientAgreement = EntityFields & {
  Agreement?: ResaleAgreement | null
  Client?: ResaleClient | null
}

export type ResaleClient = NamedEntity & {
  ClientAgreements?: ResaleClientAgreement[]
}

export type ResaleUser = NamedEntity

export type ResaleStorage = EntityFields & {
  Name?: string
  NetUid?: string
  Organization?: ResaleOrganization | null
  OrganizationId?: number
}

export type ResaleProductGroup = EntityFields & {
  Name?: string
  SubProductGroups?: Array<{
    SubProductGroup?: ResaleProductGroup
  }>
}

export type ResaleProduct = NamedEntity & {
  MeasureUnit?: NamedEntity | null
}

export type ResaleConsignmentItem = EntityFields & {
  ProductSpecification?: {
    SpecificationCode?: string
  } | null
}

export type ResaleAvailability = {
  Product?: ResaleProduct | null
}

export type ResaleItem = EntityFields & {
  ReSaleAvailability?: ResaleAvailability | null
}

export type ResaleLifeCycleStatus = {
  SaleLifeCycleType?: number
}

export type ResalePaymentStatus = {
  Name?: string
  SalePaymentStatusType?: number | string
  Value?: string
}

export type ReSale = EntityFields & {
  BaseLifeCycleStatus?: ResaleLifeCycleStatus | null
  BaseSalePaymentStatus?: ResalePaymentStatus | null
  ChangedToInvoice?: string | boolean | null
  ChangedToInvoiceBy?: ResaleUser | null
  ClientAgreement?: ResaleClientAgreement | null
  Comment?: string
  DifferencePaymentAndInvoiceAmount?: number
  IsCompleted?: boolean
  Organization?: ResaleOrganization | null
  SaleNumber?: NamedEntity | null
  TotalAmount?: number
  TotalAmountEurToUah?: number
  TotalAmountLocal?: number
  TotalPaymentAmount?: number
  TotalVat?: number
  User?: ResaleUser | null
}

export type ResalesSearchParams = {
  from: string
  isFiltered: boolean
  limit: number
  offset: number
  status: number
  to: string
}

export type ResaleExportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export type ResaleConsignmentNoteSetting = EntityFields & {
  BrandAndNumberCar?: string
  CarGrossWeight?: number
  CarHeight?: number
  CarLabel?: string
  CarLength?: number
  CarNetWeight?: number
  Carrier?: string
  CarWidth?: number
  Customer?: string
  Driver?: string
  LoadingPoint?: string
  Name?: string
  Number?: string
  TrailerGrossWeight?: number
  TrailerHeight?: number
  TrailerLabel?: string
  TrailerLength?: number
  TrailerNetWeight?: number
  TrailerNumber?: string
  TrailerWidth?: number
  TypeTransportation?: string
  UnloadingPoint?: string
}

export const ResaleDownloadDocumentType = {
  PaymentDocument: 0,
  SalesInvoice: 1,
} as const

export type ResaleDownloadDocumentType =
  (typeof ResaleDownloadDocumentType)[keyof typeof ResaleDownloadDocumentType]

export type ResaleAvailabilityFilterOptions = {
  ProductGroups: ResaleProductGroup[]
  SpecificationCodes: string[]
  Storages: ResaleStorage[]
}

export type ResaleAvailabilityFilterPayload = {
  Amount: number
  ExtraChargePercent: number
  From?: string
  IncludedProductGroups: number[]
  IncludedSpecificationCodes: string[]
  IncludedStorages: number[]
  PossibleAmountDistinct: number
  Search: string
  To?: string
}

export type GenerateAutomaticallyResalePayload = Omit<ResaleAvailabilityFilterPayload, 'From' | 'To'> & {
  SelectedStorageNetId: string
}

export type GroupingResaleAvailability = {
  AccountingGrossPrice?: number
  ConsignmentItems?: ResaleConsignmentItem[]
  CreatedReSaleAvailability?: string
  ExchangeRate?: number
  FromStorage?: ResaleStorage | null
  FromStorageId?: number
  MeasureUnit?: string
  OrganizationId?: number
  ProductGroup?: string
  ProductId: number
  ProductName?: string
  Qty?: number
  SalePrice?: number
  SpecificationCode?: string
  TotalAccountingPrice?: number
  TotalSalePrice?: number
  UpdatedReSaleAvailability?: string
  VendorCode?: string
  Weight?: number
}

export type ResaleAvailabilityWithTotals = {
  GroupReSaleAvailabilities: GroupingResaleAvailability[]
  TotalQty?: number
  TotalValueWithVat?: number
  TotalWithExtraValue?: number
}

export type ResaleAvailabilityItemModel = {
  Amount: number
  ConsignmentItem?: ResaleConsignmentItem
  ExchangeRate?: number
  FromStorageId: number
  MeasureUnit?: string
  OldValue: {
    Amount: number
    QtyToReSale: number
    SalePrice: number
  }
  OrganizationId?: number
  Price: number
  ProductId: number
  ProductName?: string
  Profit: number
  Profitability: number
  Qty: number
  QtyToReSale: number
  ReSaleAvailabilities?: unknown[]
  ReSaleItems?: ResaleItem[]
  SalePrice: number
  SpecificationCode?: string
  Vat: number
  VendorCode?: string
  Weight?: number
}

export type CreatedResaleAvailabilityWithTotals = {
  Organization?: ResaleOrganization | null
  Qty?: number
  ReSaleAvailabilityItemModels: ResaleAvailabilityItemModel[]
  Value?: number
  Vat?: number
  Weight?: number
}

export type ResaleCreatePayload = {
  ClientAgreement?: ResaleClientAgreement
  Comment?: string
  FromStorageId: number
  Organization?: ResaleOrganization | null
  ReSaleAvailabilityModels: ResaleAvailabilityItemModel[]
}

export type UpdatedResaleItemModel = {
  Amount: number
  ConsignmentItem?: ResaleConsignmentItem
  OldValue: {
    Amount: number
    QtyToReSale: number
    SalePrice: number
  }
  Price: number
  Profit: number
  Profitability: number
  Qty: number
  QtyToReSale: number
  ReSaleItems: ResaleItem[]
  SalePrice: number
  TotalAmount?: number
  TotalAmountEurToUah?: number
  TotalAmountLocal?: number
  TotalVat?: number
  Vat: number
}

export type UpdatedResaleModel = {
  ReSale: ReSale
  ReSaleItemModels: UpdatedResaleItemModel[]
  TotalAmount?: number
  TotalQty?: number
  TotalVat?: number
  TotalWeight?: number
}

export type ResaleBackendWarning = {
  Message: string
  Products?: Array<{
    ProductId?: number
    Qty?: number
    VendorCode?: string
  }>
}

export type ResaleActionResult<T> = {
  data?: T
  warning?: ResaleBackendWarning
}
