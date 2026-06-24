export type EntityFields = {
  Created?: string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: string
}

export type ProductHistoryStorage = EntityFields & {
  Name?: string
  Organization?: {
    Name?: string
  } | null
}

export type ProductHistoryProduct = EntityFields & {
  Name?: string
  NameUA?: string
  VendorCode?: string
}

export type ProductHistoryConsignmentItem = EntityFields & {
  Consignment?: {
    ProductIncome?: {
      Number?: string
    } | null
  } | null
}

export type ProductHistoryPlacement = EntityFields & {
  CellNumber?: string
  ConsignmentItem?: ProductHistoryConsignmentItem | null
  ConsignmentItemId?: number
  ConsignmentNumber?: string
  MainOriginalNumber?: string
  NameUA?: string
  ProductId?: number
  Qty?: number
  RowNumber?: string
  Storage?: ProductHistoryStorage | null
  StorageId?: number
  StorageNumber?: number | string
  VendorCode?: string
}

export type ProductAvailabilityDataHistory = EntityFields & {
  Amount?: number
  ProductPlacementDataHistory?: ProductHistoryPlacement[]
  StockStateStorageID?: number
  Storage?: ProductHistoryStorage | null
  StorageId?: number
}

export type ProductHistoryItem = EntityFields & {
  Product?: ProductHistoryProduct | null
  ProductAvailabilityDataHistory?: ProductAvailabilityDataHistory[]
  ProductId?: number
  QtyHistory?: number
  SaleId?: number
  SaleNumberId?: number
  TotalCartReservedUK?: number
  TotalReservedUK?: number
  TotalRowQty?: number
  TotalRowsQty?: number
  UserId?: number
}

export type ProductHistorySearchParams = {
  from: string
  limit: number
  offset: number
  storageIds: number[]
  to: string
  value?: string
}

export type ProductHistoryResponse = {
  Items: ProductHistoryItem[]
  Total?: number
}

export type ProductHistoryExportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}
