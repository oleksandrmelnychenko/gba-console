export type ProductSpecificationUser = {
  FirstName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
}

export type ProductSpecificationProduct = {
  Id?: number
  Name?: string
  NetUid?: string
  VendorCode?: string
}

export type ProductSpecificationSupplyInvoice = {
  Number?: string
}

export type ProductSpecificationSad = {
  Number?: string
}

export type OrderProductSpecification = {
  Qty?: number
  SadId?: number
  SupplyInvoiceId?: number
  SupplyInvoice?: ProductSpecificationSupplyInvoice | null
  Sad?: ProductSpecificationSad | null
}

export type ProductSpecification = {
  Id?: number
  NetUid?: string
  Name?: string
  SpecificationCode?: string
  Locale?: string
  DutyPercent?: number
  CustomsValue?: number
  Duty?: number
  VATValue?: number
  VATPercent?: number
  IsActive?: boolean
  AddedById?: number
  AddedBy?: ProductSpecificationUser | null
  ProductId?: number
  Product?: ProductSpecificationProduct | null
  OrderProductSpecification?: OrderProductSpecification | null
}

export const ProductSpecificationChangeMode = {
  SingleProduct: 0,
  AllProductsByName: 1,
  AllProductsByCode: 2,
} as const

export type ProductSpecificationChangeMode =
  (typeof ProductSpecificationChangeMode)[keyof typeof ProductSpecificationChangeMode]

export type ProductSpecificationRegion = 'uk' | 'pl'

export type ProductSpecificationsSearchParams = {
  limit: number
  locale: ProductSpecificationRegion
  offset: number
  specificationCode?: string
  vendorCode?: string
}

export type ChangeProductSpecificationPayload = {
  body: ProductSpecification
  specificationChangeMode: ProductSpecificationChangeMode
}

export type SpecificationCodeUploadResult = {
  InvalidVendorCodes: string[]
  ParsedCount: number
  SuccessfullyUpdatedCount: number
  UpdateWasNotRequiredCount: number
}
