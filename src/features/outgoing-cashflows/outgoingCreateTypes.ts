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
} from './types'
import {
  OUTCOME_PAYMENT_OPERATION_CODE,
  type OutcomePaymentOperationCode,
} from '../accounting/accountingOperationCatalog'

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

export const OUTCOME_OPERATION_TYPE = OUTCOME_PAYMENT_OPERATION_CODE

export type OutcomeOperationType = OutcomePaymentOperationCode

export function isGeneralOutcomeOperationType(value: unknown): value is OutcomeOperationType {
  return value === OUTCOME_OPERATION_TYPE.PaymentToSupplier
    || value === OUTCOME_OPERATION_TYPE.BuyerReturn
    || value === OUTCOME_OPERATION_TYPE.OtherOutcomeWithCounterparts
    || value === OUTCOME_OPERATION_TYPE.OtherOutcome
    || value === OUTCOME_OPERATION_TYPE.TransferToColleague
}

export const OUTGOING_CREATE_MODE = {
  PaymentGroup: 'payment-group',
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
