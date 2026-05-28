export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type ProductGroup = EntityFields & {
  Description?: string
  FullName?: string
  IsActive?: boolean
  IsSelected?: boolean
  IsSubGroup?: boolean
  Name?: string
  ProductProductGroups?: ProductProductGroup[]
  RootProductGroup?: ProductGroup | null
  RootProductGroupName?: string
  RootProductGroups?: ProductSubGroup[]
  SubProductGroups?: ProductSubGroup[]
  TotalProduct?: number
  TotalProductSubGroup?: number
}

export type ProductSubGroup = EntityFields & {
  RootProductGroup?: ProductGroup | null
  RootProductGroupId?: number
  SubProductGroup?: ProductGroup | null
  SubProductGroupId?: number
}

export type MeasureUnit = EntityFields & {
  Name?: string
}

export type Product = EntityFields & {
  Description?: string
  DescriptionUA?: string
  MainOriginalNumber?: string
  MeasureUnit?: MeasureUnit | null
  Name?: string
  NameUA?: string
  ProductGroupNames?: string
  VendorCode?: string
}

export type ProductProductGroup = EntityFields & {
  Product?: Product | null
  ProductGroup?: ProductGroup | null
  ProductGroupId?: number
  ProductId?: number
}

export type ProductGroupsWithTotal = {
  ProductGroups: ProductGroup[]
  TotalFilteredQty: number
  TotalQty: number
}

export type ProductSubGroupsWithTotal = {
  ProductSubGroups: ProductSubGroup[]
  TotalFilteredQty: number
  TotalQty: number
}

export type ProductProductGroupsWithTotal = {
  ProductProductGroups: ProductProductGroup[]
  TotalFilteredQty: number
  TotalQty: number
}
