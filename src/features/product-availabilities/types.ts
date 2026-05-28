export type EntityFields = {
  Created?: string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: string
}

export type Storage = EntityFields & {
  AvailableForReSale?: boolean
  ForDefective?: boolean
  ForEcommerce?: boolean
  ForVatProducts?: boolean
  IsResale?: boolean
  Locale?: string
  Name?: string
  Organization?: {
    Name?: string
  } | null
  OrganizationId?: number
  RetailPriority?: number
}

export type ProductPlacement = EntityFields & {
  Address?: string
  CellNumber?: string
  Qty?: number
  RowNumber?: string
  StorageNumber?: string
}

export type ConsignmentAvailabilityItem = EntityFields & {
  AccountingGrossPrice?: number
  ExchangeRate?: number
  FromDate?: string
  GrossPrice?: number
  IncomeQty?: number
  NetPrice?: number
  Placements?: ProductPlacement[]
  ProductId?: number
  ProductName?: string
  ProductNetId?: string
  Qty?: number
  StorageId?: number
  StorageName?: string
  StorageNetId?: string
  TotalNetPrice?: number
  UnitAccountingGrossPrice?: number
  UnitGrossPrice?: number
  VendorCode?: string
}

export type ProductAvailabilitiesSearchParams = {
  from: string
  limit: number
  offset: number
  storageNetId: string
  to: string
  vendorCode?: string
}

export type ProductAvailabilitiesResponse = {
  Availabilities: ConsignmentAvailabilityItem[]
  Total: number
}

export type ProductAvailabilityExportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}
