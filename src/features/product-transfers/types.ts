export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type ProductTransferOrganization = EntityFields & {
  Abbreviation?: string
  Code?: string
  FullName?: string
  Name?: string
}

export type ProductTransferStorage = EntityFields & {
  AvailableForReSale?: boolean
  ForDefective?: boolean
  ForEcommerce?: boolean
  ForVatProducts?: boolean
  IsResale?: boolean
  Locale?: string
  Name?: string
  Organization?: ProductTransferOrganization | null
  OrganizationId?: number | null
  RetailPriority?: number | null
}

export type ProductTransferUser = EntityFields & {
  Abbreviation?: string
  Email?: string
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
  PhoneNumber?: string
}

export type ProductTransferMeasureUnit = EntityFields & {
  Name?: string
  ShortName?: string
}

export type ProductTransferProduct = EntityFields & {
  Articul?: string
  MainOriginalNumber?: string
  MeasureUnit?: ProductTransferMeasureUnit | null
  Name?: string
  NameUA?: string
  VendorCode?: string
}

export type ProductTransferPlacement = EntityFields & {
  CellNumber?: string
  Qty?: number
  RowNumber?: string
  StorageNumber?: string
}

export type ProductTransferLocation = EntityFields & {
  InvoiceDocumentQty?: number
  ProductPlacement?: ProductTransferPlacement | null
  ProductPlacementId?: number
  Qty?: number
  Storage?: ProductTransferStorage | null
  StorageId?: number
}

export type ProductTransferItem = EntityFields & {
  Product?: ProductTransferProduct | null
  ProductId?: number
  ProductLocations?: ProductTransferLocation[]
  ProductTransferId?: number
  Qty?: number
  Reason?: string
}

export type ProductTransfer = EntityFields & {
  Comment?: string
  FromDate?: Date | string
  FromStorage?: ProductTransferStorage | null
  FromStorageId?: number
  IsManagement?: boolean
  Number?: string
  Organization?: ProductTransferOrganization | null
  OrganizationId?: number
  ProductTransferItems?: ProductTransferItem[]
  Responsible?: ProductTransferUser | null
  ResponsibleId?: number
  ToStorage?: ProductTransferStorage | null
  ToStorageId?: number
}

export type ProductTransfersSearchParams = {
  from: string
  limit: number
  offset: number
  to: string
}

export type ProductTransferExportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export type ProductTransferParseConfiguration = {
  EndRow: number
  QtyColumnNumber: number
  StartRow: number
  VendorCodeColumnNumber: number
}

export type ProductTransferCreateFromFilePayload = {
  file: File
  parseConfiguration: ProductTransferParseConfiguration
  productTransfer: {
    Comment: string
    FromDate: string
    FromStorage: ProductTransferStorage
    IsManagement: boolean
    ToStorage: ProductTransferStorage
  }
}
