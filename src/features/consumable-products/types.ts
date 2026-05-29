export type EntityFields = {
  Created?: string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: string
}

export type MeasureUnit = EntityFields & {
  CodeOneC?: string
  Description?: string
  Name?: string
}

export type ConsumableProduct = EntityFields & {
  ConsumableProductCategory?: ConsumableProductCategory | null
  ConsumableProductCategoryId?: number
  IsOpenEditMode?: boolean
  MeasureUnit?: MeasureUnit | null
  Name?: string
  TotalQty?: number
  VendorCode?: string
}

export type ConsumableProductCategory = EntityFields & {
  ConsumableProducts?: ConsumableProduct[]
  Description?: string
  IsNewProductMode?: boolean
  IsOpenEditMode?: boolean
  IsSupplyServiceCategory?: boolean
  Name?: string
}

export type ConsumableProductCategoryDraft = {
  isSupplyServiceCategory: boolean
  name: string
}

export type ConsumableProductDraft = {
  measureUnit: MeasureUnit | null
  name: string
  vendorCode: string
}
