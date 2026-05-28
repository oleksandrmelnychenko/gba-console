export const CLIENT_RESOURCE_STEPS = [
  'regions',
  'perfect-clients',
  'organizations',
  'tax-inspectation',
  'pricing',
  'map',
  'currencies',
  'storages',
  'measure-unit',
  'product-reserve',
  'carrier',
] as const

export type ClientResourceStep = (typeof CLIENT_RESOURCE_STEPS)[number]

export type ClientResourceEntity = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type ClientResourceTranslation = {
  CultureCode?: string
  Description?: string
  Name?: string
}

export type ClientResourceValueTranslation = ClientResourceTranslation & {
  Value?: string
}

export type ClientResourceRegionCode = ClientResourceEntity & {
  City?: string
  District?: string
  RegionId?: number
  Value?: string
}

export type ClientResourceRegion = ClientResourceEntity & {
  IsSelected?: boolean
  Name?: string
  RegionCodes?: ClientResourceRegionCode[]
}

export type ClientResourceCurrency = ClientResourceEntity & {
  Code?: string
  CurrencyTranslations?: ClientResourceTranslation[]
  IsSelected?: boolean
  Name?: string
}

export type ClientResourceTaxInspection = ClientResourceEntity & {
  InspectionAddress?: string
  InspectionName?: string
  InspectionNumber?: string
  InspectionRegionCode?: string
  InspectionRegionName?: string
  InspectionType?: string
  InspectionUSREOU?: string
}

export type ClientResourceOrganization = ClientResourceEntity & {
  Address?: string
  Code?: string
  Culture?: string
  Currency?: ClientResourceCurrency
  CurrencyId?: number
  FullName?: string
  IsIndividual?: boolean
  IsVatAgreements?: boolean
  Manager?: string
  PFURegistrationDate?: Date | string
  PFURegistrationNumber?: string
  RegistrationDate?: Date | string
  RegistrationNumber?: string
  Name?: string
  OrganizationTranslations?: ClientResourceTranslation[]
  PaymentRegisters?: ClientResourcePaymentRegister[]
  MainPaymentRegister?: ClientResourcePaymentRegister
  PhoneNumber?: string
  SROI?: string
  Storage?: ClientResourceStorage
  StorageId?: number
  TIN?: string
  TaxInspection?: ClientResourceTaxInspection
  TaxInspectionId?: number
  TypeTaxation?: number
  USREOU?: string
  VatRate?: ClientResourceVatRate
  VatRateId?: number
}

export type ClientResourcePricing = ClientResourceEntity & {
  BasePricing?: Pick<ClientResourcePricing, 'Id' | 'Name' | 'NetUid' | 'PricingTranslations'>
  BasePricingId?: number
  Comment?: string
  Currency?: ClientResourceCurrency
  CurrencyId?: number
  ExtraCharge?: number
  ForVat?: boolean
  Name?: string
  PriceType?: ClientResourcePricingType
  PriceTypeId?: number
  PricingTranslations?: ClientResourceTranslation[]
  SortingPriority?: number
}

export type ClientResourcePricingType = ClientResourceEntity & {
  Name?: string
}

export type ClientResourceStorage = ClientResourceEntity & {
  AvailableForReSale?: boolean
  ForDefective?: boolean
  ForEcommerce?: boolean
  ForVatProducts?: boolean
  IsResale?: boolean
  Locale?: string
  Name?: string
  Organization?: ClientResourceOrganization
  OrganizationId?: number
  RetailPriority?: number
}

export type ClientResourcePaymentRegister = ClientResourceEntity & {
  IsMain?: boolean
  Name?: string
}

export type ClientResourceVatRate = ClientResourceEntity & {
  Value?: number
}

export type ClientResourceMeasureUnit = ClientResourceEntity & {
  CodeOneC?: string
  Description?: string
  Name?: string
}

export type ClientResourceClientTypeRole = ClientResourceEntity & {
  ClientTypeId?: number
  Description?: string
  IsSelected?: boolean
  Name?: string
  OrderExpireDays?: number
  PermissionCheckKey?: string
}

export type ClientResourceClientType = ClientResourceEntity & {
  ClientTypeIcon?: string
  ClientTypeRoles?: ClientResourceClientTypeRole[]
  Name?: string
  PermissionCheckKey?: string
  Type?: number
}

export type ClientResourcePerfectClient = ClientResourceEntity & {
  ClientTypeRole?: ClientResourceClientTypeRole
  ClientTypeRoleId?: number
  Description?: string
  IsSelected?: boolean
  Lable?: string
  Name?: string
  PerfectClientTranslations?: ClientResourceTranslation[]
  Type?: number
  Value?: string
  Values?: ClientResourcePerfectClientValue[]
}

export type ClientResourcePerfectClientValue = ClientResourceEntity & {
  IsSelected?: boolean
  PerfectClientId?: number
  PerfectClientValueTranslations?: ClientResourceValueTranslation[]
  Value?: string
}

export type ClientResourceTransporterType = ClientResourceEntity & {
  IsSelected?: boolean
  Name?: string
  TransporterTypeTranslations?: ClientResourceTranslation[]
}

export type ClientResourceTransporter = ClientResourceEntity & {
  CssClass?: string
  ImageUrl?: string
  IsSelected?: boolean
  Name?: string
  Priority?: number
  TransporterType?: ClientResourceTransporterType
  TransporterTypeId?: number
}
