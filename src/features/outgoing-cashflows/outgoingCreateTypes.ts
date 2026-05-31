import type {
  ClientAgreement as IncomeClientAgreement,
  Client as IncomeClient,
  SupplyOrganization,
  SupplyOrganizationAgreement,
} from '../income-cashflows/types'
import type {
  Currency,
  NamedEntity,
  Organization,
  OutcomePaymentOrder,
  PaymentMovement,
} from './types'

export type CreatePaymentCurrencyRegister = {
  Amount?: number
  Created?: string
  Currency?: Currency | null
  Deleted?: boolean
  Id?: number
  IsSelected?: boolean
  NetUid?: string
  Updated?: string
}

export type CreatePaymentRegister = {
  Created?: string
  Deleted?: boolean
  Id?: number
  IsMain?: boolean
  Name?: string
  NetUid?: string
  Organization?: Organization | null
  OrganizationId?: number
  PaymentCurrencyRegisters?: CreatePaymentCurrencyRegister[]
  Type?: number
  Updated?: string
}

export type OutcomePaymentUser = NamedEntity

export type OutcomePaymentOrderCreatePayload = Omit<
  OutcomePaymentOrder,
  'Client' | 'ClientAgreement' | 'Colleague' | 'PaymentCurrencyRegister' | 'PaymentRegister'
> & {
  Client?: IncomeClient | null
  ClientAgreement?: IncomeClientAgreement | null
  Colleague?: OutcomePaymentUser | null
  ConsumableProductOrganization?: NamedEntity | SupplyOrganization | null
  ExchangeRate?: number
  OperationType?: number
  PaymentCurrencyRegister?: CreatePaymentCurrencyRegister | null
  PaymentRegister?: CreatePaymentRegister | null
  SupplyOrganizationAgreement?: SupplyOrganizationAgreement | null
  VAT?: number
  VatPercent?: number
}

export const OUTCOME_OPERATION_TYPE = {
  PaymentToSupplierByPaymentTask: 4,
  PaymentToSupplier: 5,
  BuyerReturn: 6,
  OtherOutcomeWithCounterparts: 7,
  OtherOutcome: 8,
  TransferToColleague: 10,
} as const

export type OutcomeOperationType = (typeof OUTCOME_OPERATION_TYPE)[keyof typeof OUTCOME_OPERATION_TYPE]

export const OUTGOING_CREATE_MODE = {
  ClientReturn: 'client-return',
  OrganizationPayment: 'organization-payment',
  PaymentGroup: 'payment-group',
  PaymentTasks: 'payment-tasks',
  Simple: 'simple',
} as const

export type OutgoingCreateMode = (typeof OUTGOING_CREATE_MODE)[keyof typeof OUTGOING_CREATE_MODE]

export type CreateFormState = {
  amount: number
  comment: string
  date: string
  invoiceNumber: string
  isAccounting: boolean
  isManagementAccounting: boolean
  isUnderReport: boolean
  movementSearch: string
  organizationValue: string
  paymentPurpose: string
  paymentRegisterValue: string
  selectedColleagueValue: string
  selectedCurrencyRegisterValue: string
  selectedMovementValue: string
  time: string
  userSearch: string
}

export type PaymentMovementOption = PaymentMovement
