export const TaxFreeStatus = {
  NotFormed: 0,
  Formed: 1,
  Printed: 2,
  Tabulated: 3,
  Returned: 4,
  Closed: 5,
} as const

export type TaxFreeStatus = (typeof TaxFreeStatus)[keyof typeof TaxFreeStatus]

export type EntityFields = {
  Created?: string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: string
}

export type NamedEntity = EntityFields & {
  Code?: string
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
  NamePL?: string
  NameUA?: string
  Number?: string
  VendorCode?: string
}

export type StathamPassport = EntityFields & {
  City?: string
  HouseNumber?: string
  PassportCloseDate?: string
  PassportIssuedBy?: string
  PassportIssuedDate?: string
  PassportNumber?: string
  PassportSeria?: string
  PasportName?: string
  StathamId?: number
  Street?: string
  TempId?: string
}

export type Statham = NamedEntity & {
  StathamPassports?: StathamPassport[]
}

export type TaxFreeProduct = NamedEntity

export type TaxFreePackListOrderItem = EntityFields & {
  OrderItem?: {
    Product?: TaxFreeProduct | null
  } | null
}

export type SupplyOrderUkraineCartItem = EntityFields & {
  Product?: TaxFreeProduct | null
}

export type TaxFreeItem = EntityFields & {
  Comment?: string
  OrderItem?: {
    Product?: TaxFreeProduct | null
  } | null
  ProductFullName?: string
  Qty?: number
  SupplyOrderUkraineCartItem?: SupplyOrderUkraineCartItem | null
  SupplyOrderUkraineCartItemId?: number
  TaxFreePackListOrderItem?: TaxFreePackListOrderItem | null
  TaxFreePackListOrderItemId?: number
  TotalNetWeight?: number
  TotalWithVat?: number
  TotalWithVatPl?: number
  UnitPriceWithVat?: number
  VatAmountPl?: number
}

export type TaxFreePackList = EntityFields & {
  Client?: NamedEntity | null
  ClientAgreementId?: number
  ClientId?: number
  Comment?: string
  FromDate?: string
  IsFromSale?: boolean
  IsSent?: boolean
  Number?: string
  Organization?: NamedEntity | null
  Responsible?: NamedEntity | null
}

export type TaxFreeDocument = EntityFields & {
  AmountInEur?: number
  AmountPayedStatham?: number
  CanceledDate?: string
  ClosedDate?: string
  Comment?: string
  Created?: string
  CustomCode?: string
  DateOfIssue?: string
  DateOfPrint?: string
  DateOfStathamPayment?: string
  DateOfTabulation?: string
  FormedDate?: string
  MarginAmount?: number
  Number?: string
  Responsible?: NamedEntity | null
  ResponsibleId?: number
  ReturnedDate?: string
  Statham?: Statham | null
  StathamPassport?: StathamPassport | null
  StathamPassportId?: number
  TaxFreeItems?: TaxFreeItem[]
  TaxFreePackList?: TaxFreePackList | null
  TaxFreeStatus?: TaxFreeStatus
  TotalNetWeight?: number
  TotalRowQty?: number
  TotalRowsQty?: number
  TotalWithVat?: number
  TotalWithVatPl?: number
  UnitPriceWithVat?: number
  VatAmountPl?: number
  VatPercent?: number
  Weigth?: number
}

export type TaxFreeDocumentsSearchParams = {
  from: string
  limit: number
  offset: number
  status?: TaxFreeStatus | ''
  stathamNetId?: string
  to: string
  value?: string
}

export type TaxFreeDocumentsResponse = {
  Items: TaxFreeDocument[]
  Total?: number
}

export type TaxFreeStatusOption = {
  label: string
  value: string
  status: TaxFreeStatus | ''
}

export type PrintTaxFreeResponse = {
  Message?: string
}
