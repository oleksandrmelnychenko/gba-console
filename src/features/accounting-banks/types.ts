export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type AccountingBank = EntityFields & {
  Address?: string
  City?: string
  EdrpouCode?: string
  MfoCode?: string
  Name?: string
  Phones?: string
}

export type AccountingBankFormValues = {
  address: string
  city: string
  edrpouCode: string
  mfoCode: string
  name: string
  phones: string
}
