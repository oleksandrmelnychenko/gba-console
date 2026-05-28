export type ProductStorageStorage = {
  Id?: number
  Name?: string
  NetUid?: string
}

export type ProductStoragePlacement = {
  CellNumber?: string
  Qty?: number
  RowNumber?: string
  StorageNumber?: string
}

export type ProductStorageProduct = {
  Id?: number
  Name?: string
  NetUid?: string
  ProductPlacements?: ProductStoragePlacement[]
  VendorCode?: string
}

export type ProductStorageAvailability = {
  Amount?: number
  Id?: number
  NetUid?: string
  Placements?: ProductStoragePlacement[]
  Product?: ProductStorageProduct
  ProductId?: number
  ProductName?: string
  ProductNetUid?: string
  Qty?: number
  Storage?: ProductStorageStorage
  StorageId?: number
  StorageName?: string
  StorageNetUid?: string
  VendorCode?: string
}

export type ProductStoragesSearchParams = {
  limit: number
  offset: number
  storageNetId: string
  value?: string
}

export type ProductStoragesExportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}
