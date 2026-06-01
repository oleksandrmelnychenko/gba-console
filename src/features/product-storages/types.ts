export type ProductStorageStorage = {
  ForDefective?: boolean
  Id?: number
  Name?: string
  NetUid?: string
  Organization?: ProductStorageOrganization | null
  OrganizationId?: number | null
}

export type ProductStorageOrganization = {
  FullName?: string
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
  NameUA?: string
  NetUid?: string
  ProductPlacements?: ProductStoragePlacement[]
  VendorCode?: string
}

export type ProductStorageAvailability = {
  Amount?: number
  ChangedQty?: number
  Id?: number
  IsSelected?: boolean
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
  TotalRowsQty?: number
  VendorCode?: string
}

export type ProductStorageAvailabilitiesResponse = {
  items: ProductStorageAvailability[]
  totalQty: number
}

export type ProductStoragesSearchParams = {
  from?: string
  limit: number
  offset: number
  storageNetId: string
  to?: string
  value?: string
}

export type ProductStoragesExportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
  URL?: string
  XlsxDocument?: string
  PdfDocument?: string
  url?: string
}

export type ProductStorageClient = {
  FullName?: string
  Id?: number
  Name?: string
  NetUid?: string
  SupplierName?: string
}

export type ProductStorageClientAgreement = {
  Id?: number
  Name?: string
  NetUid?: string
  Number?: string
}

export type ProductStorageAvailableConsignment = {
  ClientAgreement?: ProductStorageClientAgreement | null
  ConsignmentItemId?: number
  FromDate?: string | Date
  Organization?: ProductStorageOrganization | null
  ProductIncomeNumber?: string
  RemainingQty?: number
  Supplier?: ProductStorageClient | null
}

export type ProductStorageTransferPayload = {
  cellNumber?: string
  productTransfer: {
    Comment: string
    FromDate: string
    FromStorage: ProductStorageStorage
    IsManagement: boolean
    Organization?: ProductStorageOrganization | null
    ProductTransferItems: Array<{
      Product?: ProductStorageProduct
      Qty: number
      Reason: string
    }>
    ToStorage: ProductStorageStorage
  }
  rowNumber?: string
  storageNumber?: string
}

export type ProductStorageWriteOffPayload = {
  Comment: string
  DepreciatedOrderItems: Array<{
    Product?: ProductStorageProduct
    Qty: number
    Reason: string
  }>
  FromDate: string
  IsManagement: boolean
  Organization?: ProductStorageOrganization | null
  Storage: ProductStorageStorage
}

export type ProductStorageSupplyReturnPayload = {
  ClientAgreement?: ProductStorageClientAgreement | null
  Comment: string
  FromDate: string
  IsManagement: boolean
  Organization?: ProductStorageOrganization | null
  Storage: ProductStorageStorage
  Supplier?: ProductStorageClient | null
  SupplyReturnItems: Array<{
    ConsignmentItemId?: number
    Product?: ProductStorageProduct
    Qty: number
  }>
}
