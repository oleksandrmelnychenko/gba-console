export type EntityFields = {
  Created?: string | Date
  Deleted?: boolean
  Id?: number
  NetUid?: string
}

export type ProductCapitalizationOrganization = EntityFields & {
  Code?: string
  Name?: string
}

export type ProductCapitalizationStorage = EntityFields & {
  Name?: string
}

export type ProductCapitalizationResponsible = EntityFields & {
  FirstName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
}

export type ProductCapitalizationProduct = EntityFields & {
  Name?: string
  VendorCode?: string
}

export type ProductCapitalizationItem = EntityFields & {
  Product?: ProductCapitalizationProduct
  ProductId?: number
  ProductName?: string
  ProductVendorCode?: string
  Qty?: number
  RemainingQty?: number
  TotalAmount?: number
  TotalNetWeight?: number
  UnitPrice?: number
  Weight?: number
}

export type ProductCapitalization = EntityFields & {
  Comment?: string
  FromDate?: string
  Number?: string
  Organization?: ProductCapitalizationOrganization
  OrganizationId?: number
  ProductCapitalizationItems?: ProductCapitalizationItem[]
  Responsible?: ProductCapitalizationResponsible
  ResponsibleId?: number
  Storage?: ProductCapitalizationStorage
  StorageId?: number
  TotalAmount?: number
}

export type ProductCapitalizationsSearchParams = {
  from: string
  limit: number
  offset: number
  to: string
}

export type ProductCapitalizationsResponse = {
  Items: ProductCapitalization[]
  Total: number
}

export type ProductCapitalizationsExportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export type ProductCapitalizationSearchProduct = EntityFields & {
  Name?: string
  VendorCode?: string
}

export type ProductCapitalizationCreatePayload = {
  Comment?: string
  FromDate: string
  Organization: ProductCapitalizationOrganization
  ProductCapitalizationItems: ProductCapitalizationItem[]
  Storage: ProductCapitalizationStorage
}

export type ProductCapitalizationParseConfiguration = {
  EndRow: number
  PriceColumnNumber: number
  PricePerItem: boolean
  QtyColumnNumber: number
  StartRow: number
  VendorCodeColumnNumber: number
  WeightColumnNumber: number
  WeightPerItem: boolean
  WithPrice: boolean
  WithWeight: boolean
}

export type ProductCapitalizationItemsFromFile = {
  Items: ProductCapitalizationItem[]
  MissingVendorCodes: string[]
}
