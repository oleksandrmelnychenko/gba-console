export type EntityFields = {
  Created?: string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: string
}

export type ProductPlacementStorageLocation = EntityFields & {
  ForDefective?: boolean
  ForEcommerce?: boolean
  ForVatProducts?: boolean
  Name?: string
  Organization?: {
    Name?: string
  } | null
}

export type ProductPlacementProduct = EntityFields & {
  Name?: string
  NameUA?: string
  VendorCode?: string
}

export type ProductPlacementRow = EntityFields & {
  __returnedIndex?: number
  ErrorMessage?: string
  Placement?: string
  Product?: ProductPlacementProduct | null
  ProductId?: number
  ProductPlacementId?: number
  Qty?: number
  Responsible?: {
    FullName?: string
    LastName?: string
    Name?: string
  } | null
  Storage?: ProductPlacementStorageLocation | null
  StorageId?: number
  TotalRowQty?: number
  TotalRowsQty?: number
  VendorCode?: string
}

export type ProductPlacementsSearchParams = {
  limit: number
  offset: number
  storageIds: number[]
  to: string
  value?: string
}

export type ProductPlacementsResponse = {
  Items: ProductPlacementRow[]
  Total?: number
}

export type ProductPlacementsExportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export type ProductPlacementParseConfiguration = {
  ColumnPlacement: number
  ColumnQty: number
  ColumnVendorCode: number
  EndRow: number
  StartRow: number
}

export type ProductPlacementUploadResult = {
  ReturnedProducts: ProductPlacementRow[]
}

export type ProductPlacementReturnPayload = {
  productPlacementStorages: ProductPlacementRow[]
  storageId?: number
}
