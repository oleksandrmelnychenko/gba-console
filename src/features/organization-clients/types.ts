export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type Currency = EntityFields & {
  Code?: string
  CodeOneC?: string
  Name?: string
}

export type OrganizationClientAgreement = EntityFields & {
  Currency?: Currency
  CurrencyId?: number
  FromDate?: Date | string
  Number?: string
  OrganizationClient?: OrganizationClient
  OrganizationClientId?: number
}

export type OrganizationClient = EntityFields & {
  Address?: string
  City?: string
  Country?: string
  FullName?: string
  MarginAmount?: number
  NIP?: string
  OrganizationClientAgreements?: OrganizationClientAgreement[]
}
