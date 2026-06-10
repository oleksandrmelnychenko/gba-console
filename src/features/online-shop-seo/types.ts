export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type SeoLocale = string

export type SeoPage = EntityFields & {
  Description?: string
  KeyWords?: string
  LdJson?: string
  Locale?: SeoLocale
  PageName?: string
  Title?: string
  Url?: string
}

export type SeoContact = EntityFields & {
  Email?: string
  FirstName?: string
  ImgUrl?: string
  LastName?: string
  MiddleName?: string
  Phone?: string
}

export type SeoContactInfo = EntityFields & {
  Address?: string
  Email?: string
  Locale?: SeoLocale
  Phone?: string
  PixelId?: string
  SiteUrl?: string
}

export type SeoRetailPaymentInfo = EntityFields & {
  Comment?: string
  CultureCode?: SeoLocale
  FastOrderSuccessMessage?: string
  FullPrice?: string
  LowPrice?: string
  ScreenshotMessage?: string
}

export type SeoLocaleSettings = {
  EcommerceContactInfo?: SeoContactInfo | null
  EcommerceContactsList?: SeoContact[]
  EcommercePages?: SeoPage[]
  RetailPaymentTypeTranslate?: SeoRetailPaymentInfo | null
}

export type SeoSettingsByLocale = Record<SeoLocale, SeoLocaleSettings>

export type SeoLocaleEntry = {
  locale: SeoLocale
  settings: SeoLocaleSettings
}

export type SeoPageRow = {
  locale: SeoLocale
  page: SeoPage
}

export type SeoContactFormValues = {
  Email: string
  FirstName: string
  ImgUrl: string
  LastName: string
  MiddleName: string
  Phone: string
}

export type SeoContactInfoFormValues = {
  Address: string
  Email: string
  Phone: string
  PixelId: string
  SiteUrl: string
}

export type SeoPageFormValues = {
  Description: string
  KeyWords: string
  LdJson: string
  PageName: string
  Title: string
  Url: string
}

export type SeoPaymentFormValues = {
  Comment: string
  FastOrderSuccessMessage: string
  FullPrice: string
  LowPrice: string
  ScreenshotMessage: string
}

export type OnlineShopOrganization = EntityFields & {
  Abbreviation?: string
  FullName?: string
  Name?: string
}

export type OnlineShopClient = EntityFields & {
  ClientNumber?: string
  EmailAddress?: string
  FullName?: string
  IsActive?: boolean
  IsForRetail?: boolean
  MobileNumber?: string
  Name?: string
  SMSNumber?: string
}

export type OnlineShopCurrency = EntityFields & {
  Code?: string
  Name?: string
}

export type OnlineShopPaymentCurrencyRegister = EntityFields & {
  Currency?: OnlineShopCurrency | null
}

export type OnlineShopPaymentRegister = EntityFields & {
  AccountNumber?: string
  BankName?: string
  DefaultPaymentCurrencyRegister?: OnlineShopPaymentCurrencyRegister | null
  IBAN?: string
  IsActive?: boolean
  IsForRetail?: boolean
  IsSelected?: boolean
  Name?: string
  Organization?: OnlineShopOrganization | null
  PaymentCurrencyRegisters?: OnlineShopPaymentCurrencyRegister[]
}

export type OnlineShopStorage = EntityFields & {
  ForDefective?: boolean
  ForEcommerce?: boolean
  ForVatProducts?: boolean
  IsResale?: boolean
  Locale?: string
  Name?: string
  Organization?: OnlineShopOrganization | null
  OrganizationId?: number
  RetailPriority?: number | null
}
