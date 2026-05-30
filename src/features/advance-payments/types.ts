export type EntityFields = {
  Created?: string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: string
}

export type NamedEntity = EntityFields & {
  FullName?: string
  Name?: string
}

export type Organization = NamedEntity

export type User = NamedEntity & {
  FirstName?: string
  LastName?: string
  MiddleName?: string
}

export type AdvancePayment = EntityFields & {
  Amount?: number
  Comment?: string
  FromDate?: string
  Number?: string
  Organization?: Organization | null
  User?: User | null
  VatAmount?: number
  VatPercent?: number
}

export type AdvancePaymentsSearchParams = {
  from: string
  to: string
}
