export type SalesUkraineStatusFilter =
  | 'all'
  | 'New'
  | 'Packaging'
  | 'InvoiceChanged'
  | 'TransporterChanged'
  | 'OrderClosed'

export type SalesUkraineUserFilter = 'All' | 'Self'

export type SalesUkraineFilters = {
  clientId: string
  from: string
  limit: number
  offset: number
  organisationIds: number[]
  status: SalesUkraineStatusFilter
  to: string
  type: SalesUkraineUserFilter
  value: string
}

export type SalesUkraineEntity = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type SalesUkraineUser = SalesUkraineEntity & {
  Abbreviation?: string
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
}

export type SalesUkraineCurrency = SalesUkraineEntity & {
  Code?: string
  Name?: string
}

export type SalesUkraineOrganization = SalesUkraineEntity & {
  Name?: string
}

export type SalesUkraineAgreement = SalesUkraineEntity & {
  Currency?: SalesUkraineCurrency
  Name?: string
  Organization?: SalesUkraineOrganization
  WithVATAccounting?: boolean
}

export type SalesUkraineHistoryInvoiceEdit = SalesUkraineEntity

export type SalesUkraineClient = SalesUkraineEntity & {
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  MobileNumber?: string
  Name?: string
  PhoneNumber?: string
}

export type SalesUkraineClientAgreement = SalesUkraineEntity & {
  Agreement?: SalesUkraineAgreement
  Client?: SalesUkraineClient
}

export type SalesUkraineRetailClient = SalesUkraineEntity & {
  FullName?: string
  Name?: string
  PhoneNumber?: string
}

export type SalesUkraineStatus = SalesUkraineEntity & {
  Name?: string
  SaleLifeCycleType?: number | string
  SalePaymentStatusType?: number | string
}

export type SalesUkraineProduct = SalesUkraineEntity & {
  Articul?: string
  MainOriginalNumber?: string
  Name?: string
  NameUA?: string
  VendorCode?: string
}

export type SalesUkraineOrderItem = SalesUkraineEntity & {
  OneTimeDiscount?: number
  OneTimeDiscountComment?: string
  PricePerItem?: number
  Product?: SalesUkraineProduct
  Qty?: number
  TotalAmount?: number
  TotalAmountLocal?: number
}

export type SalesUkraineOrder = SalesUkraineEntity & {
  OrderItems?: SalesUkraineOrderItem[]
  OrderSource?: number
  TotalAmount?: number
  TotalAmountLocal?: number
  TotalCount?: number
  TotalVat?: number
}

export type SalesUkraineTransporter = SalesUkraineEntity & {
  Name?: string
  Title?: string
}

export type SalesUkraineSale = SalesUkraineEntity & {
  BaseLifeCycleStatus?: SalesUkraineStatus
  BaseSalePaymentStatus?: SalesUkraineStatus
  ChangedToInvoice?: Date | string
  ClientAgreement?: SalesUkraineClientAgreement
  Comment?: string
  FromDate?: Date | string
  HistoryInvoiceEdit?: SalesUkraineHistoryInvoiceEdit[]
  IsAcceptedToPacking?: boolean
  IsDevelopment?: boolean
  IsFullPayment?: boolean
  IsInvoice?: boolean
  IsLocked?: boolean
  IsPrinted?: boolean
  IsVatSale?: boolean
  OneTimeDiscountComment?: string
  Order?: SalesUkraineOrder
  RetailClient?: SalesUkraineRetailClient
  SaleNumber?: { Value?: string }
  TransporterId?: number | string
  TotalAmount?: number
  TotalAmountEurToUah?: number
  TotalAmountLocal?: number
  TotalCount?: number
  TotalRowsQty?: number
  Transporter?: SalesUkraineTransporter
  UpdateUser?: SalesUkraineUser
  User?: SalesUkraineUser
}

export type SalesUkraineOrganizationOption = SalesUkraineEntity & {
  Name?: string
}

export type SalesUkraineClientOption = SalesUkraineEntity & {
  FullName?: string
  LastName?: string
  FirstName?: string
  MiddleName?: string
  Name?: string
}

export type SaleDocumentResult = {
  excelUrl: string | null
  pdfUrl: string | null
}
