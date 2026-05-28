export type EntityFields = {
  Created?: string
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
