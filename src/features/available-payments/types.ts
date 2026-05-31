export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type NamedEntity = EntityFields & {
  Code?: string
  FirstName?: string
  FullName?: string
  LastName?: string
  MiddleName?: string
  Name?: string
}

export type AvailablePaymentsOrganization = NamedEntity & {
  Abbreviation?: string
}

export type AvailablePaymentsCurrency = EntityFields & {
  Code?: string
  Name?: string
}

export type AvailablePaymentDocument = EntityFields & {
  ContentType?: string
  DocumentUrl?: string
  FileName?: string
  Name?: string
  Url?: string
}

export type AvailablePaymentRegister = EntityFields & {
  IsMain?: boolean
  Name?: string
  Organization?: AvailablePaymentsOrganization | null
  OrganizationId?: number
  PaymentCurrencyRegisters?: AvailablePaymentCurrencyRegister[]
  Type?: number
}

export type AvailablePaymentCurrencyRegister = EntityFields & {
  Amount?: number
  Currency?: AvailablePaymentsCurrency | null
  PaymentRegister?: AvailablePaymentRegister | null
}

export type AvailablePaymentMovement = NamedEntity & {
  OperationName?: string
}

export type AvailablePaymentOrderSummary = EntityFields & {
  Amount?: number
  FromDate?: Date | string
  Number?: string
  PaymentCurrencyRegister?: AvailablePaymentCurrencyRegister | null
  PaymentRegister?: AvailablePaymentRegister | null
  User?: NamedEntity | null
}

export type AvailablePaymentTaskOutcome = EntityFields & {
  OutcomePaymentOrder?: AvailablePaymentOrderSummary | null
  SupplyPaymentTask?: SupplyPaymentTask | null
}

export const TaskStatusValue = {
  NotDone: 0,
  Done: 1,
  PartiallyDone: 2,
} as const

export type TaskStatusValue = (typeof TaskStatusValue)[keyof typeof TaskStatusValue]

export const AccountingTypeValue = {
  ManagementAccounting: 0,
  Accounting: 1,
  All: 2,
} as const

export type AccountingTypeValue = (typeof AccountingTypeValue)[keyof typeof AccountingTypeValue]

export type PriceTotal = {
  Currency?: AvailablePaymentsCurrency | null
  TotalPrice?: number
}

export type SupplyPaymentTask = EntityFields & {
  GrossPrice?: number
  NetPrice?: number
  EuroGrossPrice?: number
  EuroNetPrice?: number
  IsAccounting?: boolean
  IsAvailableForPayment?: boolean
  IsPayed?: boolean
  OutcomePaymentOrderSupplyPaymentTasks?: AvailablePaymentTaskOutcome[]
  PayToDate?: Date | string
  SupplyPaymentTaskDocuments?: AvailablePaymentDocument[]
  TaskStatus?: TaskStatusValue
  [key: string]: unknown
}

export type GroupedPaymentTask = EntityFields & {
  IsFutureTask?: boolean
  PayToDate?: Date | string
  PriceTotals?: PriceTotal[]
  SupplyPaymentTasks?: SupplyPaymentTask[]
  TaskStatus?: TaskStatusValue
  TotalGrossAmount?: number
  TotalNetAmount?: number
}

export type GroupedPaymentTaskWithTotals = {
  GroupedPaymentTasks: GroupedPaymentTask[]
  PriceTotals: PriceTotal[]
  TotalGrossPrice: number
}

export type AvailablePaymentsSearchParams = {
  from: string
  limit: number
  offset: number
  organizationNetId?: string
  to: string
  typePaymentTask: AccountingTypeValue
}

export type AvailablePaymentOutcomeRequest = {
  amount: number
  comment: string
  customNumber: string
  documents: File[]
  exchangeRate: number
  fromDate: string
  isAccounting: boolean
  isManagementAccounting: boolean
  models: AvailablePaymentTaskModel[]
  organization: AvailablePaymentsOrganization
  paymentPurpose: string
  selectedCurrencyRegister: AvailablePaymentCurrencyRegister
  selectedMovement: AvailablePaymentMovement
  selectedRegister: AvailablePaymentRegister
}

export type AvailablePaymentColumnKey =
  | 'category'
  | 'containerNumber'
  | 'currency'
  | 'date'
  | 'discount'
  | 'grossPrice'
  | 'name'
  | 'netPrice'
  | 'number'
  | 'pricePerUnit'
  | 'quantity'
  | 'serviceNumber'
  | 'symbol'
  | 'total'
  | 'totalWithoutVat'
  | 'vatAmount'
  | 'vatPercent'
  | 'vendorCode'

export type AvailablePaymentColumnFormat = 'date' | 'price' | 'text'

export type AvailablePaymentColumn = {
  align?: 'left' | 'right'
  format: AvailablePaymentColumnFormat
  header: string
  key: AvailablePaymentColumnKey
}

export type AvailablePaymentTaskModel = {
  columns: AvailablePaymentColumn[]
  currency?: AvailablePaymentsCurrency | null
  currencyCode: string
  deliveryProductProtocolNetUid: string
  documents: AvailablePaymentDocument[]
  grossPrice: number
  id: string
  organization?: AvailablePaymentsOrganization | null
  organizationName: string
  organizationNetUid: string
  paidOrder?: AvailablePaymentOrderSummary | null
  payForClient?: NamedEntity | null
  rows: AvailablePaymentTaskRow[]
  serviceAgreementNetId: string
  serviceName: string
  serviceNumber: string
  supplyOrderNetUid: string
  supplyOrderUkraineNetUid: string
  task: SupplyPaymentTask
}

export type AvailablePaymentTaskRow = {
  [key in AvailablePaymentColumnKey]?: Date | number | string | undefined
}

export type AvailablePaymentAccountingCashFlow = {
  Collection?: unknown[]
  Items?: unknown[]
  [key: string]: unknown
}
