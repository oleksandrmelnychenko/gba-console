export type EntityFields = {
  Created?: string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: string
}

export type NamedEntity = EntityFields & {
  Code?: string
  FirstName?: string
  FullName?: string
  LastName?: string
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
  PaymentRegister?: PaymentAccount | null
  PaymentRegisterCurrencyExchanges?: PaymentRegisterCurrencyExchange[]
  PaymentRegisterTransfers?: PaymentRegisterTransfer[]
  IncomePaymentOrders?: PaymentAccountIncomeOrder[]
  OutcomePaymentOrders?: PaymentAccountOutcomeOrder[]
}

export type PaymentAccount = EntityFields & {
  AccountNumber?: string
  BankName?: string
  City?: string
  CVV?: string
  FromDate?: string
  IBAN?: string
  IncomePaymentOrders?: PaymentAccountIncomeOrder[]
  IsActive?: boolean
  IsForRetail?: boolean
  Name?: string
  Organization?: Organization | null
  OutcomePaymentOrders?: PaymentAccountOutcomeOrder[]
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

export const PaymentRegisterTransferType = {
  Income: 0,
  Outcome: 1,
  All: 2,
} as const

export type PaymentRegisterTransferType = (typeof PaymentRegisterTransferType)[keyof typeof PaymentRegisterTransferType]

export const TransferOperationType = {
  FundsTransfer: 0,
  CashBankTransfer: 1,
  PaymentRegisterTransfer: 2,
} as const

export type TransferOperationType = (typeof TransferOperationType)[keyof typeof TransferOperationType]

export type PaymentMovementOperation = EntityFields & {
  PaymentMovement?: NamedEntity & {
    OperationName?: string
  }
}

export type PaymentRegisterTransfer = EntityFields & {
  Amount?: number
  Comment?: string
  FromDate?: string
  FromPaymentCurrencyRegister?: PaymentCurrencyRegister | null
  IsCanceled?: boolean
  Number?: number | string
  PaymentMovementOperation?: PaymentMovementOperation | null
  ToPaymentCurrencyRegister?: PaymentCurrencyRegister | null
  Type?: PaymentRegisterTransferType
  TypeOfOperation?: TransferOperationType
  User?: NamedEntity | null
}

export type PaymentRegisterCurrencyExchange = EntityFields & {
  Amount?: number
  Comment?: string
  ExchangeRate?: number
  FromDate?: string
  FromPaymentCurrencyRegister?: PaymentCurrencyRegister | null
  IncomeNumber?: number | string
  IsCanceled?: boolean
  Number?: number | string
  PaymentMovementOperation?: PaymentMovementOperation | null
  ToPaymentCurrencyRegister?: PaymentCurrencyRegister | null
  Type?: PaymentRegisterTransferType
  User?: NamedEntity | null
}

export type PaymentAccountIncomeOrder = EntityFields & {
  Amount?: number
  Client?: NamedEntity | null
  Colleague?: NamedEntity | null
  Comment?: string
  Currency?: Currency | null
  FromDate?: string
  IsCanceled?: boolean
  Number?: number | string
  Organization?: Organization | null
  PaymentMovementOperation?: PaymentMovementOperation | null
  SupplyOrganization?: NamedEntity | null
  User?: NamedEntity | null
}

export type PaymentAccountOutcomeOrder = EntityFields & {
  Amount?: number
  ClientAgreement?: {
    Client?: NamedEntity | null
  } | null
  Colleague?: NamedEntity | null
  Comment?: string
  ConsumableProductOrganization?: NamedEntity | null
  FromDate?: string
  IsCanceled?: boolean
  Number?: number | string
  Organization?: Organization | null
  PaymentCurrencyRegister?: PaymentCurrencyRegister | null
  PaymentMovementOperation?: PaymentMovementOperation | null
  User?: NamedEntity | null
}

export type PaymentAccountActivitySearchParams = {
  currencyNetId?: string
  from: string
  fromCurrencyNetId?: string
  netId: string
  to: string
  toCurrencyNetId?: string
  type?: PaymentRegisterTransferType
}
