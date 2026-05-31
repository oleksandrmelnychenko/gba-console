export type RegionCode = {
  City?: string
  District?: string
  Value?: string
  Id?: number
  NetUid?: string
  RegionId?: number
  Region?: Region
  IsSelected?: boolean
}

export type Region = {
  Id?: number
  Name?: string
  NetUid?: string
  RegionCodes?: RegionCode[]
  IsSelected?: boolean
}

export type Country = {
  Id?: number
  Name?: string
  NetUid?: string
  Code?: string
}

export type Currency = {
  Id?: number
  Name?: string
  NetUid?: string
  Code?: string
  IsSelected?: boolean
}

export type Incoterm = {
  Id?: number
  NetUid?: string
  IncotermName?: string
}

export type PackingMarking = {
  Id?: number
  NetUid?: string
  Name?: string
}

export type PackingMarkingPayment = {
  Id?: number
  NetUid?: string
  Name?: string
}

export type TermsOfDelivery = {
  Id?: number
  NetUid?: string
  Name?: string
}

export type ManagerRole = {
  Id?: number
  NetUid?: string
  Name?: string
}

export type Manager = {
  Id?: number
  NetUid?: string
  FirstName?: string
  LastName?: string
  MiddleName?: string
  Abbreviation?: string
  FullName?: string
  Name?: string
  Email?: string
  EmailAddress?: string
  PhoneNumber?: string
  IsActive?: boolean
  IsSelected?: boolean
  UserRole?: ManagerRole
}

export type ClientTypeRole = {
  ClientTypeId?: number
  Id?: number
  Name?: string
  NetUid?: string
  OrderExpireDays?: number
  PermissionCheckKey?: string
}

export type ClientType = {
  ClientTypeIcon?: string
  ClientTypeRoles?: ClientTypeRole[]
  Id?: number
  Name?: string
  NetUid?: string
  PermissionCheckKey?: string
  Type?: number
}

export type ClientInRole = {
  ClientType?: ClientType
  ClientTypeRole?: ClientTypeRole
}

export type ClientSubClient = {
  Id?: number
  NetUid?: string
  RootClient?: Client
  SubClient?: Client
}

export type PriceType = {
  Id?: number
  NetUid?: string
  Name?: string
}

export type Pricing = {
  Id?: number
  NetUid?: string
  Name?: string
  Comment?: string
  ExtraCharge?: number
  ForVat?: boolean
  BasePricingId?: number
  CurrencyId?: number
  PriceTypeId?: number
  PriceType?: PriceType
  Currency?: Currency
  BasePricing?: Pricing
  SortingPriority?: number
}

export type ProviderPricing = {
  Id?: number
  NetUid?: string
  Name?: string
  CurrencyId?: number
  BasePricingId?: number
  Currency?: Currency
  Pricing?: Pricing
}

export type Organization = {
  Id?: number
  NetUid?: string
  Name?: string
  FullName?: string
  Code?: string
  TIN?: string
  USREOU?: string
  SROI?: string
  PhoneNumber?: string
  Address?: string
  IsIndividual?: boolean
  Currency?: Currency
  Manager?: string
  VatRateId?: number
  VatRate?: VatRate
  IsVatAgreements?: boolean
}

export type VatRate = {
  Id?: number
  NetUid?: string
  Value?: number
}

export type ProductGroupDiscount = {
  Id?: number
  NetUid?: string
  ClientAgreementId?: number
  ParentProductGroupDiscountId?: number
  ProductGroupId?: number
  IsActive?: boolean
  DiscountRate?: number
  ProductGroup?: unknown
  SubProductGroupDiscounts?: ProductGroupDiscount[]
  IsSelected?: boolean
}

export type Agreement = {
  Id?: number
  IsActive?: boolean
  Name?: string
  NetUid?: string
  IsControlAmountDebt?: boolean
  IsControlNumberDaysDebt?: boolean
  IsPrePaymentFull?: boolean
  AmountDebt?: number
  DeferredPayment?: string
  PrePaymentPercentages?: number
  TermsOfPayment?: string
  NumberDaysDebt?: number
  IsManagementAccounting?: boolean
  IsAccounting?: boolean
  IsPayForDelivery?: boolean
  WithVATAccounting?: boolean
  ClientId?: number
  CurrencyId?: number
  Currency?: Currency
  OrganizationId?: number
  Organization?: Organization
  ProviderPricingId?: number
  ProviderPricing?: ProviderPricing
  PricingId?: number
  Pricing?: Pricing
  ClientInDebts?: ClientInDebt[]
  ClientAgreements?: ClientAgreement[]
  Number?: string
  FromDate?: Date | string
  ToDate?: Date | string
  PromotionalPricing?: Pricing
  PromotionalPricingId?: number
  ForReSale?: boolean
  FullName?: string
  IsSelected?: boolean
  TempId?: number
  WithAgreementLine?: boolean
  Created?: Date | string
  Updated?: Date | string
  Deleted?: boolean
}

export type ClientAgreement = {
  Agreement?: Agreement
  Id?: number
  NetUid?: string
  ClientId?: number
  AgreementId?: number
  Client?: Client
  CurrentAmount?: number
  ProductReservationTerm?: number
  ProductGroupDiscounts?: ProductGroupDiscount[]
  FromAmg?: boolean
  OriginalClientName?: string
  AgreementName?: string
  AccountBalance?: number
  Created?: Date | string
  Updated?: Date | string
  Deleted?: boolean
}

export type AgreementUpsert = Agreement

export type Debt = {
  Id?: number
  NetUid?: string
  Name?: string
}

export type ClientInDebt = {
  Id?: number
  NetUid?: string
  ClientId?: number
  AgreementId?: number
  DebtId?: number
  Client?: Client
  Agreement?: Agreement
  Debt?: Debt
  SaleId?: number
  ReSaleId?: number
  IsSelected?: boolean
}

export type ServicePayer = {
  Id?: number
  NetUid?: string
  FirstName?: string
  LastName?: string
  MiddleName?: string
  MobilePhone?: string
  Comment?: string
  PaymentAddress?: string
  PaymentCard?: string
  ServiceType?: number
  Created?: Date | string
  Updated?: Date | string
  Deleted?: boolean
}

export type ClientGroup = {
  Id?: number | string
  NetUid?: string
  Name?: string
}

export type ClientWorkplace = {
  Id?: number
  NetUid?: string
  MainClientId?: number | string
  WorkplaceId?: number | string
  MainClient?: Client
  WorkplaceClient?: Client
  ClientGroup?: ClientGroup | unknown
  FirstName?: string
  MiddleName?: string
  LastName?: string
  Abbreviation?: string
  Region?: string
  Email?: string
  PhoneNumber?: string
  IsBlocked?: boolean
  ClientGroupId?: number | string
  Password?: string
  WorkplaceClientAgreements?: WorkplaceClientAgreement[]
}

export type WorkplaceClientAgreement = {
  Id?: number
  NetUid?: string
  WorkplaceId?: number | string
  ClientAgreementId?: number | string
  Workplace?: ClientWorkplace
  ClientAgreement?: ClientAgreement
  IsSelected?: boolean
}

export type DeliveryRecipientAddress = {
  Id?: number
  NetUid?: string
  Value?: string
  Department?: string
  City?: string
  DeliveryRecipientId?: number
  Priority?: number
  IsSelected?: boolean
  SaleNetId?: string
}

export type DeliveryRecipient = {
  Id?: number
  NetUid?: string
  FullName?: string
  ClientId?: number
  Priority?: number
  Client?: Client
  MobilePhone?: string
  DeliveryRecipientAddresses?: DeliveryRecipientAddress[]
  IsSelected?: boolean
  SaleNetId?: string
  Created?: Date | string
  Updated?: Date | string
  Deleted?: boolean
}

export const PerfectClientType = {
  Checkbox: 1,
  Toggle: 2,
} as const

export type PerfectClientTypeValue = (typeof PerfectClientType)[keyof typeof PerfectClientType]

export type ClientPerfectClientValue = {
  Value?: string
  IsSelected?: boolean
  PerfectClientId?: number
  PerfectClientValueTranslations?: unknown[]
}

export type PerfectClient = {
  Id?: number
  NetUid?: string
  Lable?: string
  Value?: string
  IsSelected?: boolean
  Description?: string
  Type?: PerfectClientTypeValue
  Values?: ClientPerfectClientValue[]
  ClientTypeRoleId?: number
  ClientTypeRole?: ClientTypeRole
  PerfectClientTranslations?: unknown[]
}

export type ClientOrderedProduct = {
  ProductVendorCode?: string
  ProductName?: string
  Qty?: number
}

export type ClientPasswordChange = {
  netId?: string
  password?: string
  mobileNumber?: string
}

export type ClientContractDocument = {
  Id?: number
  NetUid?: string
  DocumentUrl?: string
  FileName?: string
  ContentType?: string
  GeneratedName?: string
  Deleted?: boolean
  Source?: unknown
  Created?: Date | string
  Updated?: Date | string
}

export type ClientBankDetailAccountNumber = {
  Id?: number
  NetUid?: string
  AccountNumber?: string
  Currency?: Currency
}

export type ClientBankDetailIbanNo = {
  Id?: number
  NetUid?: string
  IBANNO?: string
  Currency?: Currency
}

export type ClientBankDetails = {
  Id?: number
  NetUid?: string
  BankAndBranch?: string
  AccountNumber?: ClientBankDetailAccountNumber
  ClientBankDetailIbanNo?: ClientBankDetailIbanNo
  Swift?: string
  BranchCode?: string
  BankAddress?: string
}

export type Client = {
  [key: string]: unknown
  Abbreviation?: string
  AccountantNumber?: string
  ActualAddress?: string
  Brand?: string
  ClearCartAfterDays?: number
  ClientAgreements?: ClientAgreement[]
  ClientBankDetails?: ClientBankDetails
  ClientContractDocuments?: ClientContractDocument[]
  ClientGroupId?: number | string | null
  ClientInDebts?: ClientInDebt[]
  ClientInRole?: ClientInRole
  ClientManagers?: ClientUserProfile[]
  ClientTypeId?: number
  SubClients?: ClientSubClient[]
  RootClients?: ClientSubClient[]
  RootClient?: Client
  RootClientId?: number
  ClientNumber?: string
  Comment?: string
  Country?: Country
  Created?: Date | string
  Deleted?: boolean
  DeliveryAddress?: string
  DirectorNumber?: string
  EmailAddress?: string
  FaxNumber?: string
  FirstName?: string
  FullName?: string
  ICQ?: string
  Id?: number
  Incoterm?: Incoterm
  IncotermsElse?: string
  IsBlocked?: boolean
  IsClientExpanded?: boolean
  IsForRetail?: boolean
  IsIndividual?: boolean
  IsActive?: boolean
  IsIncotermsElse?: boolean
  IsNotResident?: boolean
  IsSelected?: boolean
  IsSubClient?: boolean
  IsTemporaryClient?: boolean
  IsTradePoint?: boolean
  LastName?: string
  LegalAddress?: string
  MainManagerId?: number
  Manufacturer?: string
  Manager?: string
  MiddleName?: string
  MobileNumber?: string
  Name?: string
  NetUid?: string
  OrderExpireDays?: number
  OriginalRegionCode?: string
  PackingMarking?: PackingMarking
  PackingMarkingPayment?: PackingMarkingPayment
  PerfectClients?: PerfectClient[]
  RegionCode?: RegionCode
  Region?: Region
  RegionCodeId?: number
  RegionId?: number
  SROI?: string
  SMSNumber?: string
  ServicePayers?: ServicePayer[]
  Street?: string
  SupplierCode?: string
  SupplierContactName?: string
  SupplierName?: string
  TIN?: string
  TermsOfDelivery?: TermsOfDelivery
  TotalCurrentAmount?: number
  USREOU?: string
  Updated?: Date | string
}

export type ClientUserProfile = {
  Id?: number
  NetUid?: string
  ClientId?: number
  UserProfileId?: number
  Client?: Client
  UserProfile?: Manager
}

export type ClientUpsertResult = Client | null

export type ClientSearchParams = {
  active?: boolean | null
  filterEntityType?: number
  filterOperationSql?: string
  filterSql?: string
  forReSale?: boolean | null
  limit: number
  offset: number
  sortDescriptors?: import('../../shared/api/searchQuery').ServerSearchSortDescriptor[]
  typeRoleFilter?: string
  value?: string
}

export type ClientPrintDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export type ClientFilterOperationItem = {
  Id?: number
  Name?: string
  NetUid?: string
  SQL?: string
}

export type ClientFilterItem = {
  Description?: string
  FilterOperationItem?: ClientFilterOperationItem
  Id?: number
  Name?: string
  NetUid?: string
  Order?: number
  SQL?: string
  Type?: number
}
