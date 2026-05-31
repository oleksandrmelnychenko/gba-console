export type EntityFields = {
  Created?: string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: string
}

export type NamedEntity = EntityFields & {
  Code?: string
  FullName?: string
  Name?: string
}

export type Currency = NamedEntity

export type Organization = NamedEntity

export const PaymentRegisterType = {
  Cash: 0,
  Card: 1,
  Bank: 2,
} as const

export type PaymentRegisterType = (typeof PaymentRegisterType)[keyof typeof PaymentRegisterType]

export type PaymentCurrencyRegister = EntityFields & {
  Amount?: number
  Currency?: Currency | null
  IsSelected?: boolean
}

export type PaymentAccount = EntityFields & {
  AccountNumber?: string
  BankName?: string
  City?: string
  CVV?: string
  FromDate?: string
  IBAN?: string
  IsActive?: boolean
  IsForRetail?: boolean
  Name?: string
  Organization?: Organization | null
  PaymentCurrencyRegisters?: PaymentCurrencyRegister[]
  SortCode?: string
  SwiftCode?: string
  ToDate?: string
  TotalEuroAmount?: number
  Type?: PaymentRegisterType
}

export type BankItem = EntityFields & {
  Address?: string
  City?: string
  EdrpouCode?: string
  MfoCode?: string
  Name?: string
  Phones?: string
}

export type PaymentAccountsSearchParams = {
  organizationNetId?: string
  type?: PaymentRegisterType | ''
  value?: string
}

export type PaymentAccountsResponse = {
  paymentRegisters: PaymentAccount[]
  totalEuroAmount: number
}

export type PaymentAccountPayload = PaymentAccount & {
  Name: string
  Organization: Organization
  PaymentCurrencyRegisters: PaymentCurrencyRegister[]
  Type: PaymentRegisterType
}
