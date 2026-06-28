export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type ProductRemainOrganization = EntityFields & {
  FullName?: string
  Name?: string
}

export type ProductRemainStorage = EntityFields & {
  AvailableForReSale?: boolean
  ForDefective?: boolean
  ForEcommerce?: boolean
  ForVatProducts?: boolean
  IsResale?: boolean
  Locale?: string
  Name?: string
  Organization?: ProductRemainOrganization | null
  OrganizationId?: number | null
  RetailPriority?: number | null
}

export type ProductRemainSupplier = EntityFields & {
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
  SupplierCode?: string
}

export type ProductRemainProduct = EntityFields & {
  MainOriginalNumber?: string
  Name?: string
  NameUA?: string
  VendorCode?: string
}

export type GroupedConsignmentItem = EntityFields & {
  AccountingGrossPrice?: number
  FromDate?: Date | string
  GrossPrice?: number
  NetPrice?: number
  Product?: ProductRemainProduct | null
  RemainingQty?: number
  Weight?: number
}

export type GroupedConsignment = EntityFields & {
  AccountingTotalGrossPrice?: number
  FromDate?: Date | string
  GroupedConsignmentItems?: GroupedConsignmentItem[]
  InvoiceNumber?: string
  ItemsCount?: number
  OrganizationName?: string
  ProductIncomeNumber?: string
  RowNumber?: number
  SupplierName?: string
  TotalGrossPrice?: number
  TotalWeight?: number
}

export type RemainingConsignment = EntityFields & {
  AccountingGrossPrice?: number
  ConsignmentItemNetId?: string
  CurrencyName?: string
  FromDate?: Date | string
  GrossPrice?: number
  InvoiceNumber?: string
  NetPrice?: number
  OrganizationName?: string
  Product?: ProductRemainProduct | null
  ProductIncomeNumber?: string
  RemainingQty?: number
  RowNumber?: number
  StorageName?: string
  SupplierName?: string
  TotalNetPrice?: number
  Weight?: number
}

export type ProductRemainMovement = EntityFields & {
  AccountingPrice?: number
  ClientName?: string
  Comment?: string
  Discount?: number
  DocumentFromDate?: Date | string
  DocumentNumber?: string
  DocumentType?: string
  IncomeDocumentFromDate?: Date | string
  IncomeDocumentNumber?: string
  IncomeQty?: number
  IsEdited?: boolean
  OrganizationName?: string
  OutcomeQty?: number
  Price?: number
  Responsible?: string
  StorageName?: string
}

export type ProductRemainMovementSearchParams = {
  consignmentItemNetId: string
  from: string
  to: string
}

export type CollectionWithTotals<TItem> = {
  AccountingTotalAmount?: number
  AccountingTotalAmountFiltered?: number
  AccountingTotalAmountLocal?: number
  AccountingTotalAmountLocalFiltered?: number
  Collection: TItem[]
  TotalAmount?: number
  TotalAmountFiltered?: number
  TotalAmountLocal?: number
  TotalAmountLocalFiltered?: number
  TotalQty?: number
  TotalQtyFiltered?: number
  TotalRowsQty?: number
  TotalRowsQtyFiltered?: number
}

export type ProductRemainsSearchParams = {
  from: string
  includeItems?: boolean
  limit: number
  offset: number
  storageNetId?: string
  supplierNetId?: string
  to: string
}

export type ProductRemainsByProductSearchParams = ProductRemainsSearchParams & {
  searchValue: string
  storageNetId: string
}

export type ProductRemainSupplierSearchParams = {
  limit: number
  offset: number
  value: string
}

export type ProductRemainsExportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
  URL?: string
  XlsxDocument?: string
  PdfDocument?: string
  url?: string
}
