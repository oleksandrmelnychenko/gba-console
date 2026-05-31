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
  MiddleName?: string
  Name?: string
  Number?: string
  OperationName?: string
}

export type Currency = NamedEntity

export type Organization = NamedEntity

export type OrganizationWithDefaults = Organization & {
  MainPaymentRegister?: PaymentRegister | null
}

export const PaymentRegisterType = {
  Cash: 0,
  Card: 1,
  Bank: 2,
} as const

export type PaymentRegisterType = (typeof PaymentRegisterType)[keyof typeof PaymentRegisterType]

export const IncomePaymentOperationType = {
  ClientPayment: 0,
  SupplierReturn: 1,
  OtherAccountingWithCounterparts: 2,
  OtherIncome: 3,
  ReturnFromColleague: 9,
} as const

export type IncomePaymentOperationType =
  (typeof IncomePaymentOperationType)[keyof typeof IncomePaymentOperationType]

export const IncomePaymentOrderType = {
  Cash: 0,
  Transfer: 1,
} as const

export type IncomePaymentOrderType = (typeof IncomePaymentOrderType)[keyof typeof IncomePaymentOrderType]

export const IncomeCounterpartySearchType = {
  Client: 0,
  Manufacturer: 7,
  Supplier: 33,
} as const

export type IncomeCounterpartySearchType =
  (typeof IncomeCounterpartySearchType)[keyof typeof IncomeCounterpartySearchType]

export type PaymentCurrencyRegister = EntityFields & {
  Amount?: number
  Currency?: Currency | null
  IsSelected?: boolean
}

export type PaymentRegister = NamedEntity & {
  IsMain?: boolean
  Organization?: Organization | null
  OrganizationId?: number
  PaymentCurrencyRegisters?: PaymentCurrencyRegister[]
  Type?: number
}

export type PaymentMovement = EntityFields & {
  OperationName?: string
}

export type PaymentMovementOperation = EntityFields & {
  PaymentMovement?: PaymentMovement | null
}

export type Debt = EntityFields & {
  Days?: number
  Total?: number
}

export type SaleNumber = EntityFields & {
  Value?: string
}

export type Sale = EntityFields & {
  ChangedToInvoice?: string
  Created?: string
  SaleNumber?: SaleNumber | null
  TotalAmount?: number
  TotalAmountLocal?: number
}

export type ReSale = EntityFields & {
  ChangedToInvoice?: string
  Created?: string
  SaleNumber?: SaleNumber | null
  TotalAmount?: number
  TotalAmountLocal?: number
}

export type Agreement = EntityFields & {
  Client?: Client | null
  ClientInDebts?: ClientInDebt[]
  Currency?: Currency | null
  CurrencyId?: number
  IsSelected?: boolean
  Name?: string
  Number?: string
  Organization?: Organization | null
  OrganizationId?: number
}

export type ClientInDebt = EntityFields & {
  Agreement?: Agreement | null
  AgreementId?: number
  Debt?: Debt | null
  IsSelected?: boolean
  ReSale?: ReSale | null
  ReSaleId?: number
  Sale?: Sale | null
  SaleId?: number
}

export type IncomePaymentOrderSale = EntityFields & {
  Amount?: number
  ReSale?: ReSale | null
  ReSaleId?: number
  Sale?: Sale | null
  SaleId?: number
}

export type AssignedPaymentOrder = EntityFields & {
  Amount?: number
  Number?: string
}

export type ClientAgreement = EntityFields & {
  Agreement?: Agreement | null
  AgreementId?: number
  AccountBalance?: number
  Client?: Client | null
  CurrentAmount?: number
  Name?: string
  Number?: string
}

export type SupplyOrganizationAgreement = EntityFields & {
  Currency?: Currency | null
  CurrentAmount?: number
  CurrentEuroAmount?: number
  IsSelected?: boolean
  Name?: string
  Number?: string
  Organization?: Organization | null
}

export type Client = NamedEntity & {
  ClientAgreements?: ClientAgreement[]
  ClientInDebts?: ClientInDebt[]
  PhoneNumber?: string
}

export type RetailClient = NamedEntity & {
  Client?: Client | null
  PhoneNumber?: string
  Sales?: Sale[]
}

export type SupplyOrganization = NamedEntity & {
  SupplyOrganizationAgreements?: SupplyOrganizationAgreement[]
}

export type ClientDebtTotal = {
  TotalEuro?: number
  TotalLocal?: number
}

export type IncomeExchangeCalculation = {
  ConvertedAmount?: number
}

export type IncomePaymentOrder = EntityFields & {
  Amount?: number
  ArrivalNumber?: string
  AssignedPaymentOrders?: AssignedPaymentOrder[]
  AgreementExchangedAmount?: number
  Client?: Client | null
  ClientAgreement?: ClientAgreement | null
  Colleague?: NamedEntity | null
  Comment?: string
  Currency?: Currency | null
  ExchangeRate?: number
  FromDate?: string
  IsAccounting?: boolean
  IsCanceled?: boolean
  IsManagementAccounting?: boolean
  IncomeCashOrderType?: IncomePaymentOrderType
  IncomePaymentOrderSales?: IncomePaymentOrderSale[]
  Number?: string
  OperationTypeName?: string
  OperationType?: string | number
  Organization?: Organization | null
  PaymentCurrencyRegister?: PaymentCurrencyRegister | null
  PaymentMovementOperation?: PaymentMovementOperation | null
  PaymentPurpose?: string
  PaymentRegister?: PaymentRegister | null
  RootAssignedPaymentOrder?: AssignedPaymentOrder | null
  SupplyOrganization?: SupplyOrganization | null
  SupplyOrganizationAgreement?: SupplyOrganizationAgreement | null
  TotalQty?: number
  User?: NamedEntity | null
  VatPercent?: number
  VAT?: number
}

export type IncomeCashflowsSearchParams = {
  currencyNetId?: string
  from: string
  limit: number
  offset: number
  organizationIds?: number[]
  registerNetId?: string
  to: string
  value?: string
}

export type IncomeCashflowRow = {
  amount?: number
  comment?: string
  currency?: string
  fromDate?: string
  id: string
  income: IncomePaymentOrder
  isAccounting?: boolean
  isCanceled?: boolean
  isManagementAccounting?: boolean
  number?: string
  operationType?: string
  organization?: string
  payer?: string
  paymentMovement?: string
  paymentRegister?: string
  responsible?: string
  rootAssigned?: boolean
}
