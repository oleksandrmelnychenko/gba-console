export type RegionCode = {
  City?: string
  District?: string
  Value?: string
}

export type Region = {
  Id?: number
  Name?: string
  NetUid?: string
}

export type Country = {
  Id?: number
  Name?: string
  NetUid?: string
}

export type Currency = {
  Id?: number
  Name?: string
  NetUid?: string
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

export type Agreement = {
  Id?: number
  IsActive?: boolean
  Name?: string
  NetUid?: string
}

export type ClientAgreement = {
  Agreement?: Agreement
  Id?: number
  NetUid?: string
}

export type ClientBankDetails = {
  AccountNumber?: {
    AccountNumber?: string
    Currency?: Currency
  }
  BankAddress?: string
  BankAndBranch?: string
  BranchCode?: string
  ClientBankDetailIbanNo?: {
    Currency?: Currency
    IBANNO?: string
  }
  Swift?: string
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
  ClientInRole?: ClientInRole
  ClientManagers?: unknown[]
  SubClients?: ClientSubClient[]
  RootClients?: ClientSubClient[]
  ClientNumber?: string
  Comment?: string
  Country?: Country
  Created?: Date | string
  Deleted?: boolean
  DeliveryAddress?: string
  DirectorNumber?: string
  EmailAddress?: string
  FirstName?: string
  FullName?: string
  Id?: number
  Incoterm?: unknown
  IncotermsElse?: string
  IsBlocked?: boolean
  IsIndividual?: boolean
  IsActive?: boolean
  IsIncotermsElse?: boolean
  IsNotResident?: boolean
  IsSubClient?: boolean
  IsTemporaryClient?: boolean
  IsTradePoint?: boolean
  LastName?: string
  LegalAddress?: string
  Manufacturer?: string
  Manager?: string
  MiddleName?: string
  MobileNumber?: string
  Name?: string
  NetUid?: string
  OrderExpireDays?: number
  PackingMarking?: unknown
  PackingMarkingPayment?: unknown
  PerfectClients?: unknown[]
  RegionCode?: RegionCode
  Region?: Region
  RegionCodeId?: number
  RegionId?: number
  SROI?: string
  SMSNumber?: string
  ServicePayers?: unknown[]
  Street?: string
  SupplierCode?: string
  SupplierContactName?: string
  SupplierName?: string
  TIN?: string
  TermsOfDelivery?: unknown
  TotalCurrentAmount?: number
  USREOU?: string
  Updated?: Date | string
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
