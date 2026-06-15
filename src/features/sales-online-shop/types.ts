import type {
  SalesUkraineHistoryInvoiceEdit,
  SalesUkraineSaleMerged,
} from '../sales-ukraine/types'

export type SalesOnlineShopStatusFilter =
  | 'all'
  | 'New'
  | 'Packaging'
  | 'InvoiceChanged'
  | 'TransporterChanged'
  | 'OrderClosed'

export type SalesOnlineShopUserFilter = 'All' | 'Self'

export type SalesOnlineShopFilters = {
  from: string
  limit: number
  offset: number
  status: SalesOnlineShopStatusFilter
  to: string
  type: SalesOnlineShopUserFilter
  value: string
}

export type SalesOnlineShopEntity = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type SalesOnlineShopUser = SalesOnlineShopEntity & {
  Abbreviation?: string
  Email?: string
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
  PhoneNumber?: string
}

export type SalesOnlineShopCurrency = SalesOnlineShopEntity & {
  Code?: string
  Name?: string
}

export type SalesOnlineShopOrganization = SalesOnlineShopEntity & {
  Name?: string
}

export type SalesOnlineShopAgreement = SalesOnlineShopEntity & {
  Currency?: SalesOnlineShopCurrency
  Name?: string
  Organization?: SalesOnlineShopOrganization
  WithVATAccounting?: boolean
}

export type SalesOnlineShopClient = SalesOnlineShopEntity & {
  EmailAddress?: string
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  MobileNumber?: string
  PhoneNumber?: string
}

export type SalesOnlineShopClientAgreement = SalesOnlineShopEntity & {
  Agreement?: SalesOnlineShopAgreement
  Client?: SalesOnlineShopClient
}

export type SalesOnlineShopRetailClient = SalesOnlineShopEntity & {
  Email?: string
  FirstName?: string
  FullName?: string
  LastName?: string
  Name?: string
  Phone?: string
  PhoneNumber?: string
}

export type SalesOnlineShopStatus = SalesOnlineShopEntity & {
  Name?: string
  SaleLifeCycleType?: number | string
  SalePaymentStatusType?: number | string
}

export type SalesOnlineShopSaleNumber = {
  Value?: string
}

export type SalesOnlineShopProduct = SalesOnlineShopEntity & {
  Articul?: string
  MainOriginalNumber?: string
  Name?: string
  NameUA?: string
  VendorCode?: string
}

export type SalesOnlineShopOrderItem = SalesOnlineShopEntity & {
  OneTimeDiscount?: number
  OneTimeDiscountComment?: string
  PricePerItem?: number
  Product?: SalesOnlineShopProduct
  Qty?: number
  TotalAmount?: number
  TotalAmountLocal?: number
}

export type SalesOnlineShopOrder = SalesOnlineShopEntity & {
  OrderItems?: SalesOnlineShopOrderItem[]
  OrderSource?: number
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalCount?: number
  TotalVat?: number
}

export type SalesOnlineShopTransporter = SalesOnlineShopEntity & {
  CssClass?: string
  ImageUrl?: string | null
  Name?: string
  Title?: string
}

export type SalesOnlineShopSale = SalesOnlineShopEntity & {
  BaseLifeCycleStatus?: SalesOnlineShopStatus
  BaseSalePaymentStatus?: SalesOnlineShopStatus
  ChangedToInvoice?: Date | string
  ClientAgreement?: SalesOnlineShopClientAgreement
  Comment?: string
  FromDate?: Date | string
  HistoryInvoiceEdit?: SalesUkraineHistoryInvoiceEdit[]
  InputSaleMerges?: SalesUkraineSaleMerged[]
  IsAcceptedToPacking?: boolean
  IsDevelopment?: boolean
  IsFullPayment?: boolean
  IsInvoice?: boolean
  IsLocked?: boolean
  IsPrinted?: boolean
  IsSent?: boolean
  IsVatSale?: boolean
  MisplacedSaleId?: string
  OneTimeDiscountComment?: string
  Order?: SalesOnlineShopOrder
  RetailClient?: SalesOnlineShopRetailClient
  SaleNumber?: SalesOnlineShopSaleNumber
  ShipmentDate?: Date | string
  TotalAmount?: number
  TotalAmountEurToUah?: number
  TotalAmountLocal?: number
  TotalCount?: number
  TotalRowsQty?: number
  TransporterId?: number | string
  TTN?: string
  Transporter?: SalesOnlineShopTransporter
  UpdateUser?: SalesOnlineShopUser
  User?: SalesOnlineShopUser
}
