export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type DepreciatedOrderOrganization = EntityFields & {
  Abbreviation?: string
  Code?: string
  FullName?: string
  Name?: string
}

export type DepreciatedOrderStorage = EntityFields & {
  AvailableForReSale?: boolean
  ForDefective?: boolean
  ForEcommerce?: boolean
  ForVatProducts?: boolean
  IsResale?: boolean
  Locale?: string
  Name?: string
  Organization?: DepreciatedOrderOrganization | null
  OrganizationId?: number | null
  RetailPriority?: number | null
}

export type DepreciatedOrderUser = EntityFields & {
  Abbreviation?: string
  Email?: string
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
  PhoneNumber?: string
}

export type DepreciatedOrderMeasureUnit = EntityFields & {
  Name?: string
  ShortName?: string
}

export type DepreciatedOrderProduct = EntityFields & {
  Articul?: string
  MainOriginalNumber?: string
  MeasureUnit?: DepreciatedOrderMeasureUnit | null
  Name?: string
  NameUA?: string
  VendorCode?: string
}

export type DepreciatedOrderPlacement = EntityFields & {
  CellNumber?: string
  Qty?: number
  RowNumber?: string
  SpecificationQty?: number
  StorageNumber?: string
}

export type DepreciatedOrderLocation = EntityFields & {
  ProductPlacement?: DepreciatedOrderPlacement | null
  ProductPlacementId?: number
  Qty?: number
  Storage?: DepreciatedOrderStorage | null
  StorageId?: number
}

export type DepreciatedOrderItem = EntityFields & {
  DepreciatedOrderId?: number
  Product?: DepreciatedOrderProduct | null
  ProductId?: number
  ProductLocations?: DepreciatedOrderLocation[]
  Qty?: number
  Reason?: string
}

export type DepreciatedOrder = EntityFields & {
  Comment?: string
  DepreciatedOrderItems?: DepreciatedOrderItem[]
  FromDate?: Date | string
  IsManagement?: boolean
  Number?: string
  Organization?: DepreciatedOrderOrganization | null
  OrganizationId?: number
  Responsible?: DepreciatedOrderUser | null
  ResponsibleId?: number
  Storage?: DepreciatedOrderStorage | null
  StorageId?: number
}

export type DepreciatedOrdersSearchParams = {
  from: string
  limit: number
  offset: number
  to: string
}

export type DepreciatedOrderExportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export type DepreciatedOrderParseConfiguration = {
  EndRow: number
  QtyColumnNumber: number
  StartRow: number
  VendorCodeColumnNumber: number
}

export type DepreciatedOrderCreateFromFilePayload = {
  file: File
  parseConfiguration: DepreciatedOrderParseConfiguration
  depreciatedOrder: {
    Comment: string
    FromDate: string
    IsManagement: boolean
    Storage: DepreciatedOrderStorage
  }
}

export type DepreciatedOrderCreateFromFileResult = {
  exceptions: string[]
  message: string
}
