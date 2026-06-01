export type EntityBase = {
  Id?: number
  NetUid?: string
}

export type NamedEntity = EntityBase & {
  FullName?: string
  LastName?: string
  Name?: string
}

export type Currency = EntityBase & {
  Code?: string
}

export type Organization = NamedEntity

export type Agreement = NamedEntity & {
  Currency?: Currency
  FullName?: string
  OrganizationId?: number
}

export type ClientAgreement = EntityBase & {
  Agreement?: Agreement
  AgreementId?: number
  Client?: Client
}

export type Client = NamedEntity & {
  ClientAgreements?: ClientAgreement[]
  USREOU?: string
}

export type Product = NamedEntity & {
  VendorCode?: string
}

export type OrderItem = EntityBase & {
  Product?: Product
  TotalAmount?: number
  TotalAmountLocal?: number
}

export type SupplyOrderUkraineCartItem = EntityBase & {
  AvailableQty?: number
  ChangedQty?: number
  Coef?: number
  IsDirty?: boolean
  IsSelected?: boolean
  MaxQtyPerTF?: number
  NetWeight?: number
  PackageSize?: number
  Product?: Product
  ReservedQty?: number
  Supplier?: Client
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalNetWeight?: number
  UnitPrice?: number
  UnitPriceLocal?: number
  UnpackedQty?: number
  UploadedQty?: number
}

export type TaxFreePackListOrderItem = EntityBase & {
  Coef?: number
  IsSelected?: boolean
  MaxQtyPerTF?: number
  NetWeight?: number
  OrderItem?: OrderItem
  PackageSize?: number
  Qty?: number
  TaxFreeItems?: TaxFreeItem[]
  TotalNetWeight?: number
  UnitPrice?: number
  UnitPriceLocal?: number
  UnpackedQty?: number
}

export const TaxFreeStatus = {
  NotFormed: 0,
  Formed: 1,
  Printed: 2,
  Tabulated: 3,
  Returned: 4,
  Closed: 5,
} as const

export type TaxFreeStatus = (typeof TaxFreeStatus)[keyof typeof TaxFreeStatus]

export type TaxFreeStatusOption = {
  label: string
  value: TaxFreeStatus
}

export type TaxFreeDocument = EntityBase & {
  ContentType?: string
  FileName?: string
}

export type StathamPassport = EntityBase & {
  City?: string
  HouseNumber?: string
  PasportName?: string
  PassportCloseDate?: string
  PassportIssuedBy?: string
  PassportIssuedDate?: string
  PassportNumber?: string
  PassportSeria?: string
  Street?: string
}

export type Statham = NamedEntity & {
  FirstName?: string
  MiddleName?: string
  StathamPassports?: StathamPassport[]
}

export type TaxFreeItem = EntityBase & {
  ChangedQty?: number
  Comment?: string
  IsDirty?: boolean
  IsEditMode?: boolean
  IsSelected?: boolean
  ProductFullName?: string
  Qty?: number
  SupplyOrderUkraineCartItem?: SupplyOrderUkraineCartItem
  TaxFreePackListOrderItem?: TaxFreePackListOrderItem
  TotalNetWeight?: number
  TotalWithVat?: number
  TotalWithVatPl?: number
  UnitPriceWithVat?: number
  VatAmountPl?: number
}

export type TaxFree = EntityBase & {
  AmountInEur?: number
  AmountInPLN?: number
  ClosedDate?: string
  Comment?: string
  CustomCode?: string
  DateOfIssue?: string
  DateOfPrint?: string
  MarginAmount?: number
  Number?: string
  Statham?: Statham
  StathamPassport?: StathamPassport
  TaxFreeDocuments?: TaxFreeDocument[]
  TaxFreeItems?: TaxFreeItem[]
  TaxFreeStatus?: TaxFreeStatus
  TotalNetWeight?: number
  TotalWithVat?: number
  TotalWithVatPl?: number
  VatAmountInPLN?: number
}

export type Sale = EntityBase & {
  ClientAgreement?: ClientAgreement
}

export type TaxFreePackList = EntityBase & {
  Client?: Client
  ClientAgreement?: ClientAgreement
  Comment?: string
  FromDate?: string
  IsFromSale?: boolean
  IsSent?: boolean
  MarginAmount?: number
  MaxPositionsInTaxFree?: number
  MaxPriceLimit?: number
  MaxQtyInTaxFree?: number
  MaxQtyPerTF?: number
  MinPriceLimit?: number
  Number?: string
  Organization?: Organization
  Responsible?: NamedEntity
  Sales?: Sale[]
  Status?: string
  SupplyOrderUkraineCartItems?: SupplyOrderUkraineCartItem[]
  SupplyOrderUkraineId?: number
  TaxFreePackListOrderItems?: TaxFreePackListOrderItem[]
  TaxFrees?: TaxFree[]
  TaxFreesCount?: number
  TotalRowsQty?: number
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalUnspecifiedAmount?: number
  TotalUnspecifiedAmountLocal?: number
  TotalUnspecifiedWeight?: number
  TotalVatAmountLocal?: number
  TotalWeight?: number
  WeightLimit?: number
}

export type TaxFreePrintDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export type TaxFreePackListsSearchParams = {
  from: string
  limit: number
  offset: number
  to: string
}

export type TaxFreePackListsResponse = {
  items: TaxFreePackList[]
  totalQty?: number
}

export type SupplyOrderFromPackListPayload = {
  ClientAgreement?: ClientAgreement
  FromDate?: string
  Number?: string
  Organization?: Organization
  Supplier?: Client
}
