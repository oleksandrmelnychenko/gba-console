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
}

export type ProductRemainsSearchParams = {
  from: string
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
}
