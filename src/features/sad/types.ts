export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type SadCurrency = EntityFields & {
  Code?: string
  Name?: string
}

export type SadOrganization = EntityFields & {
  Abbreviation?: string
  Code?: string
  FullName?: string
  Name?: string
}

export type SadUser = EntityFields & {
  Email?: string
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
}

export type SadClient = EntityFields & {
  Abbreviation?: string
  FullName?: string
  MarginAmount?: number
  Name?: string
  USREOU?: string
}

export type SadAgreement = EntityFields & {
  Currency?: SadCurrency | null
  CurrencyId?: number
  FullName?: string
  Name?: string
  Number?: string
}

export type SadClientAgreement = EntityFields & {
  Agreement?: SadAgreement | null
  AgreementId?: number
  Client?: SadClient | null
  ClientId?: number
  FullName?: string
}

export type SadOrganizationClientAgreement = EntityFields & {
  Currency?: SadCurrency | null
  CurrencyId?: number
  FromDate?: Date | string
  Number?: string
  OrganizationClientId?: number
}

export type SadOrganizationClient = SadClient & {
  Address?: string
  City?: string
  Country?: string
  MarginAmount?: number
  OrganizationClientAgreements?: SadOrganizationClientAgreement[]
}

export type SadStathamCar = EntityFields & {
  Brand?: string
  Model?: string
  Number?: string
}

export type SadStatham = EntityFields & {
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  StathamCars?: SadStathamCar[]
}

export type SadDocument = EntityFields & {
  ContentType?: string
  FileName?: string
  SadId?: number
}

export type SadProductSpecification = EntityFields & {
  CustomsValue?: number
  Duty?: number
  DutyPercent?: number
  IsActive?: boolean
  Locale?: string
  Name?: string
  Product?: SadProduct | null
  ProductId?: number
  SpecificationCode?: string
  VATPercent?: number
  VATValue?: number
}

export type SadProduct = EntityFields & {
  MainOriginalNumber?: string
  Name?: string
  NameUA?: string
  ProductSpecifications?: SadProductSpecification[]
  VendorCode?: string
}

export type SadSupplyOrderUkraineCartItem = EntityFields & {
  ChangedQty?: number
  Comment?: string
  Product?: SadProduct | null
  ProductId?: number
  ReservedQty?: number
  Supplier?: SadClient | null
  SupplierId?: number
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalNetWeight?: number
  UnitPrice?: number
  UnitPriceLocal?: number
  UnpackedQty?: number
}

export type SadOrderItem = EntityFields & {
  AssignedSpecification?: { SpecificationCode?: string }
  PricePerItem?: number
  Product?: SadProduct | null
  ProductId?: number
  Qty?: number
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalWeight?: number
  User?: SadUser | null
}

export type SadItem = EntityFields & {
  ChangedQty?: number
  Comment?: string
  IsSelected?: boolean
  NetWeight?: number
  OrderItem?: SadOrderItem | null
  OrderItemId?: number
  Qty?: number
  SadId?: number
  Supplier?: SadClient | null
  SupplierId?: number
  SupplyOrderUkraineCartItem?: SadSupplyOrderUkraineCartItem | null
  SupplyOrderUkraineCartItemId?: number
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalAmountWithMargin?: number
  TotalGrossWeight?: number
  TotalNetWeight?: number
  TotalVatAmount?: number
  TotalVatAmountWithMargin?: number
  UnitPrice?: number
  UnpackedQty?: number
}

export type SadPalletType = EntityFields & {
  Name?: string
}

export type SadPalletItem = EntityFields & {
  ChangedQty?: number
  IsDirty?: boolean
  IsError?: boolean
  IsSelected?: boolean
  Qty?: number
  SadItem?: SadItem | null
  SadItemId?: number
  SadPalletId?: number
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalGrossWeight?: number
  TotalNetWeight?: number
}

export type SadPallet = EntityFields & {
  Comment?: string
  IsDirty?: boolean
  Number?: string
  SadId?: number
  SadPalletItems?: SadPalletItem[]
  SadPalletType?: SadPalletType | null
  SadPalletTypeId?: number
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalGrossWeight?: number
  TotalNetWeight?: number
}

export type SadSaleNumber = EntityFields & {
  Value?: string
}

export type SadSale = EntityFields & {
  ClientAgreement?: SadClientAgreement | null
  FromDate?: Date | string
  Order?: {
    OrderItems?: SadOrderItem[]
  } | null
  SaleNumber?: SadSaleNumber | null
  TotalAmount?: number
  TotalAmountLocal?: number
}

export const SAD_TYPES = {
  Sad: 0,
  TIR: 1,
} as const

export type SadTypeValue = (typeof SAD_TYPES)[keyof typeof SAD_TYPES]

export type Sad = EntityFields & {
  Client?: SadClient | null
  ClientAgreement?: SadClientAgreement | null
  Comment?: string
  FromDate?: Date | string
  IsFromSale?: boolean
  IsSend?: boolean
  MarginAmount?: number
  Number?: string
  Organization?: SadOrganization | null
  OrganizationClient?: SadOrganizationClient | null
  OrganizationClientAgreement?: SadOrganizationClientAgreement | null
  Responsible?: SadUser | null
  SadCoefficient?: number
  SadDocuments?: SadDocument[]
  SadItems?: SadItem[]
  SadPallets?: SadPallet[]
  SadType?: SadTypeValue
  Sales?: SadSale[]
  Statham?: SadStatham | null
  StathamCar?: SadStathamCar | null
  SupplyOrderUkraineId?: number
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalAmountWithMargin?: number
  TotalGrossWeight?: number
  TotalNetWeight?: number
  TotalQty?: number
  TotalVatAmount?: number
  TotalVatAmountWithMargin?: number
  VatPercent?: number
}

export type SadSearchParams = {
  from: string
  limit: number
  offset: number
  to: string
}

export type SadPrintDocument = {
  ExportFacturaDocumentURL?: string
  ExportFacturaPdfDocumentURL?: string
  ExportSpecificationDocumentURL?: string
  ExportSpecificationPdfDocumentURL?: string
  FacturaDocumentURL?: string
  FacturaPdfDocumentURL?: string
  SpecificationDocumentURL?: string
  SpecificationPdfDocumentURL?: string
}

export type SadSpecificationParseConfiguration = {
  CustomsValue: number | ''
  Duty: number | ''
  EndRow: number | ''
  SpecificationCode: number | ''
  StartRow: number | ''
  VATValue: number | ''
  VendorCode: number | ''
}
