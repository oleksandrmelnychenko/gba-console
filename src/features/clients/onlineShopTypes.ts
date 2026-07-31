import type { SaleOrderItem } from './salesTypes'
import type { Client, ClientAgreement, Currency } from './types'

export type RetailClient = {
  [key: string]: unknown
  City?: string
  Client?: Client
  Created?: Date | string
  Email?: string
  EmailAddress?: string
  EcommerceRegion?: RetailClientRegion
  FirstName?: string
  FullName?: string
  Id?: number
  LastName?: string
  MiddleName?: string
  MobileNumber?: string
  Name?: string
  NetUid?: string
  Phone?: string
  PhoneNumber?: string
  Sales?: RetailSale[]
  ShoppingCartJson?: string
}

export type RetailClientsPage = {
  Items: RetailClient[]
  Total: number
}

export type RetailClientRegion = {
  IsLocalPayment?: boolean
  NameRu?: string
  NameUa?: string
}

export type RetailProduct = {
  [key: string]: unknown
  Articul?: string
  AvailableQtyUk?: number
  BarCode?: string
  Brand?: string
  CurrencyCode?: string
  CurrentPrice?: number
  CurrentLocalPrice?: number
  Description?: string
  DescriptionUA?: string
  HasImage?: boolean
  Id?: number
  Image?: string
  ImageUrl?: string
  MainOriginalNumber?: string
  Name?: string
  NameUA?: string
  NetUid?: string
  ProductImage?: string
  ProductImages?: Array<{
    Deleted?: boolean
    ImageUrl?: string
    IsMainImage?: boolean
  }>
  VendorCode?: string
}

export type RetailCartItem = {
  [key: string]: unknown
  Count?: number
  Currency?: Currency
  CurrencyCode?: string
  ExchangeRateAmount?: number
  Id?: number
  LocalCurrency?: Currency
  LocalCurrencyCode?: string
  NetUid?: string
  Price?: number
  PricePerItem?: number
  Product?: RetailProduct
  ProductImage?: string
  ProductName?: string
  Quantity?: number
  Qty?: number
  Sum?: number
  Total?: number
  TotalAmount?: number
  TotalAmountLocal?: number
  UnitPrice?: number
  VendorCode?: string
}

export type RetailOrder = {
  [key: string]: unknown
  OrderItems?: RetailCartItem[]
  OrderSource?: number
  TotalAmount?: number
  TotalAmountLocal?: number
}

export type RetailSaleStatus = {
  [key: string]: unknown
  Name?: string
  SaleLifeCycleType?: number
  Type?: number
}

export type RetailSaleNumber = {
  Value?: string
}

export type RetailSale = {
  [key: string]: unknown
  BaseLifeCycleStatus?: RetailSaleStatus
  BaseSalePaymentStatus?: RetailSaleStatus
  ClientAgreement?: ClientAgreement
  Created?: Date | string
  FromDate?: Date | string
  Id?: number
  NetUid?: string
  Order?: RetailOrder
  RetailClient?: RetailClient
  SaleNumber?: RetailSaleNumber
  ShipmentDate?: Date | string
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalCount?: number
}

export type IncompleteSale = {
  [key: string]: unknown
  Id?: number
  MisplacedSaleStatus?: unknown
  NetUid?: string
  OrderItems?: SaleOrderItem[]
  RetailClient?: RetailClient
  Sale?: RetailSale
  User?: unknown
  WithSales?: boolean
}

export type IncompleteSalesSearchParams = {
  from?: string
  isAccepted?: boolean
  number?: string
  to?: string
}
