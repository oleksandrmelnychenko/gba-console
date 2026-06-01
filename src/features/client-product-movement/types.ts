export type ClientProductMovementClientOption = {
  Id?: number
  NetUid?: string
  FullName?: string
  LastName?: string
  FirstName?: string
  MiddleName?: string
  Name?: string
}

export type ClientProductMovementOrganizationOption = {
  Id?: number
  Name?: string
}

export type ClientProductMovementProduct = {
  VendorCode?: string
  Name?: string
}

export type ClientProductMovementInfoItem = {
  Product?: ClientProductMovementProduct
  ProductSpecificationCode?: string
  Responsible?: string
  TotalAmount?: number
  ItemQty?: number
  PricePerItem?: number
}

export type ClientProductMovementDocument = {
  DocumentId?: number
  DocumentTypeName?: string
  DocumentNumber?: string
  DocumentFromDate?: string
  DocumentUpdatedDate?: string
  OrganizationName?: string
  TotalEuroAmount?: number
  TotalPositions?: number
  Responsible?: string
  TotalRowsQty?: number
  InfoItems?: ClientProductMovementInfoItem[]
}

export type ClientProductMovementFilters = {
  clientNetId: string
  from: string
  to: string
  limit: number
  offset: number
  organizationId: string[]
  article: string
}

export type ClientProductMovementDocumentResult = {
  excelUrl: string | null
  pdfUrl: string | null
}
