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
  Address?: string
  Name?: string
}

export type SaleConsignmentNoteSetting = SalesUkraineEntity & {
  BrandAndNumberCar?: string
  CarGrossWeight?: number
  CarHeight?: number
  CarLabel?: string
  CarLength?: number
  CarNetWeight?: number
  Carrier?: string
  CarWidth?: number
  Customer?: string
  Driver?: string
  LoadingPoint?: string
  Name?: string
  Number?: string
  TrailerGrossWeight?: number
  TrailerHeight?: number
  TrailerLabel?: string
  TrailerLength?: number
  TrailerNetWeight?: number
  TrailerNumber?: string
  TrailerWidth?: number
  TypeTransportation?: string
  UnloadingPoint?: string
}

export type SaleConsignmentDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export type SaleClientDebtTotal = {
  TotalEuro?: number
  TotalLocal?: number
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
  IsSubClient?: boolean
  IsTradePoint?: boolean
  LastName?: string
  MiddleName?: string
  MobileNumber?: string
  Name?: string
  PhoneNumber?: string
  RegionCode?: { Value?: string }
}

export type SalesUkraineTransporterType = SalesUkraineEntity & {
  Name?: string
}

export type SalesUkraineDeliveryRecipient = SalesUkraineEntity & {
  FullName?: string
  MobilePhone?: string
}

export type SalesUkraineDeliveryRecipientAddress = SalesUkraineEntity & {
  City?: string
  Department?: string
}

export type SalesUkraineCustomersOwnTtn = SalesUkraineEntity & {
  Number?: string
  TtnPDFPath?: string
}

export type SalesUkraineUpdateDataCarrier = SalesUkraineEntity & {
  CashOnDeliveryAmount?: number
  City?: string
  Comment?: string
  Department?: string
  FullName?: string
  HasDocument?: boolean
  IsCashOnDelivery?: boolean
  MobilePhone?: string
  Number?: string
  ShipmentDate?: Date | string
  Transporter?: SalesUkraineTransporter
  TtnPDFPath?: string
  User?: SalesUkraineUser
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
  ImageUrl?: string
  Name?: string
  Title?: string
  TransporterTypeId?: number
}

export type SalesUkraineSale = SalesUkraineEntity & {
  BaseLifeCycleStatus?: SalesUkraineStatus
  BaseSalePaymentStatus?: SalesUkraineStatus
  CashOnDeliveryAmount?: number
  ChangedToInvoice?: Date | string
  ClientAgreement?: SalesUkraineClientAgreement
  Comment?: string
  CustomersOwnTtn?: SalesUkraineCustomersOwnTtn | null
  CustomersOwnTtnId?: number
  DeliveryRecipient?: SalesUkraineDeliveryRecipient | null
  DeliveryRecipientAddress?: SalesUkraineDeliveryRecipientAddress | null
  FromDate?: Date | string
  HasDocuments?: boolean
  HistoryInvoiceEdit?: SalesUkraineHistoryInvoiceEdit[]
  InputSaleMerges?: SalesUkraineSaleMerged[]
  IsAcceptedToPacking?: boolean
  IsCashOnDelivery?: boolean
  IsDevelopment?: boolean
  IsFullPayment?: boolean
  IsInvoice?: boolean
  IsLocked?: boolean
  IsPrinted?: boolean
  IsPrintedPaymentInvoice?: boolean
  IsSent?: boolean
  IsVatSale?: boolean
  OneTimeDiscountComment?: string
  Order?: SalesUkraineOrder
  RetailClient?: SalesUkraineRetailClient
  SaleNumber?: { Value?: string }
  ShipmentDate?: Date | string
  TTN?: string
  TransporterId?: number | string
  UpdateDataCarrier?: SalesUkraineUpdateDataCarrier[]
  TotalAmount?: number
  TotalAmountEurToUah?: number
  TotalAmountLocal?: number
  TotalCount?: number
  TotalRowsQty?: number
  Transporter?: SalesUkraineTransporter
  UpdateUser?: SalesUkraineUser
  User?: SalesUkraineUser
}

export type SalesUkraineSaleMerged = {
  InputSale?: SalesUkraineSale
  InputSaleId?: number
  IsEditMode?: boolean
  IsSelected?: boolean
  OutputSale?: SalesUkraineSale
  OutputSaleId?: number
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
  invoiceExcelUrl: string | null
  invoicePdfUrl: string | null
  isAcceptedToPacking: boolean
}
