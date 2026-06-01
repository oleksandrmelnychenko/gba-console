export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type SupplyReturnOrganization = EntityFields & {
  Abbreviation?: string
  Code?: string
  FullName?: string
  Name?: string
}

export type SupplyReturnStorage = EntityFields & {
  Locale?: string
  Name?: string
  Organization?: SupplyReturnOrganization | null
  OrganizationId?: number | null
}

export type SupplyReturnUser = EntityFields & {
  Abbreviation?: string
  Email?: string
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
}

export type SupplyReturnClient = EntityFields & {
  FirstName?: string
  FullName?: string
  LastName?: string
  Name?: string
  SupplierName?: string
}

export type SupplyReturnClientAgreement = EntityFields & {
  Name?: string
  Number?: string
}

export type SupplyReturnMeasureUnit = EntityFields & {
  Name?: string
  ShortName?: string
}

export type SupplyReturnProduct = EntityFields & {
  Articul?: string
  MainOriginalNumber?: string
  MeasureUnit?: SupplyReturnMeasureUnit | null
  Name?: string
  NameUA?: string
  VendorCode?: string
}

export type SupplyReturnItem = EntityFields & {
  ConsignmentItemId?: number
  Product?: SupplyReturnProduct | null
  ProductId?: number
  Qty?: number
  Storage?: SupplyReturnStorage | null
  SupplyReturnId?: number
  TotalNetPrice?: number
  TotalNetWeight?: number
}

export type SupplyReturn = EntityFields & {
  ClientAgreement?: SupplyReturnClientAgreement | null
  ClientAgreementId?: number
  Comment?: string
  FromDate?: Date | string
  IsManagement?: boolean
  Number?: string
  Organization?: SupplyReturnOrganization | null
  OrganizationId?: number
  Responsible?: SupplyReturnUser | null
  ResponsibleId?: number
  Storage?: SupplyReturnStorage | null
  StorageId?: number
  Supplier?: SupplyReturnClient | null
  SupplierId?: number
  SupplyReturnItems?: SupplyReturnItem[]
  TotalNetPrice?: number
  TotalNetWeight?: number
  TotalRowsQty?: number
}

export type SupplyReturnsResponse = {
  items: SupplyReturn[]
  totalQty: number
}

export type SupplyReturnsSearchParams = {
  from: string
  limit: number
  offset: number
  to: string
}

export type SupplyReturnExportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}
