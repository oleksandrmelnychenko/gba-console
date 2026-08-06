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
  TotalAmountEurToUah?: number
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
  HasDetails?: boolean
  HistoryInvoiceEdit?: SalesUkraineHistoryInvoiceEdit[]
  InputSaleMerges?: SalesUkraineSaleMerged[]
  IsAcceptedToPacking?: boolean
  IsDevelopment?: boolean
  IsFullPayment?: boolean
  IsInvoice?: boolean
  IsLocked?: boolean
  IsPrinted?: boolean
  IsPrintedPaymentInvoice?: boolean
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
  TotalPositions?: number
  TotalRowsQty?: number
  TransporterId?: number | string
  TTN?: string
  Transporter?: SalesOnlineShopTransporter
  UpdateUser?: SalesOnlineShopUser
  User?: SalesOnlineShopUser
}

export type EcommerceImageSearchStatus = 'processing' | 'completed' | 'failed'

export type EcommerceImageSearchAnalysis = {
  application?: string[]
  category?: string
  confidence?: number
  description?: string
  dimensions?: string | null
  material?: string | null
  name?: string
  nameEn?: string
  oem?: string[]
  searchQueries?: string[]
  subcategory?: string | null
  system?: string
}

export type EcommerceImageSearchRequestMetadata = {
  ClientIpAddress?: string | null
  UserAgent?: string | null
  Referrer?: string | null
  AcceptLanguage?: string | null
  CountryCode?: string | null
  Region?: string | null
  City?: string | null
  TimeZone?: string | null
  Latitude?: string | null
  Longitude?: string | null
  RequestHost?: string | null
  RequestProtocol?: string | null
  SecChUa?: string | null
  SecChUaPlatform?: string | null
  SecChUaMobile?: string | null
  DeviceType?: 'bot' | 'desktop' | 'mobile' | 'tablet' | 'unknown' | null
  ProxyRequestId?: string | null
}

export type EcommerceImageSearchListItem = {
  NetUid: string
  CreatedAtUtc: string
  CompletedAtUtc?: string | null
  Status: EcommerceImageSearchStatus
  Locale: string
  IsAuthenticated: boolean
  UserNetUid?: string | null
  OriginalFileName: string
  ImageContentType: string
  ImageSizeBytes: number
  IdentifiedName?: string | null
  Category?: string | null
  VehicleSystem?: string | null
  Confidence?: number | null
  ProductCount: number
  AiModel?: string | null
  ProcessingMilliseconds?: number | null
  ErrorCode?: string | null
}

export type EcommerceImageSearchDetail = EcommerceImageSearchListItem & {
  SourceRequestId: string
  ImageSha256: string
  RequestMetadata?: EcommerceImageSearchRequestMetadata | null
  Analysis?: EcommerceImageSearchAnalysis | null
  CatalogSearchStatus?: string | null
  CatalogQueryCount: number
  CatalogFailedQueryCount: number
  ErrorMessage?: string | null
}

export type EcommerceImageSearchListResponse = {
  Items: EcommerceImageSearchListItem[]
  Limit: number
  Offset: number
  Total: number
}

export type EcommerceImageSearchFilters = {
  limit: number
  offset: number
  status?: EcommerceImageSearchStatus | 'all'
  value?: string
}
