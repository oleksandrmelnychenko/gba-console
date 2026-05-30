export type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

export type NamedEntity = EntityFields & {
  Code?: string
  FullName?: string
  Name?: string
}

export type AvailablePaymentsOrganization = NamedEntity & {
  Abbreviation?: string
}

export type AvailablePaymentsCurrency = EntityFields & {
  Code?: string
  Name?: string
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
  PayToDate?: Date | string
  TaskStatus?: TaskStatusValue
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
