import type { ClientAgreement, Organization, PaymentMovement } from '../income-cashflows/types'
import {
  OUTCOME_OPERATION_TYPE,
  type CreatePaymentCurrencyRegister,
  type CreatePaymentRegister,
  type OutcomePaymentOrderCreatePayload,
} from './outgoingCreateTypes'

type BuildOutgoingClientReturnPayloadParams = {
  amount: number
  clientAgreement: ClientAgreement
  comment: string
  exchangeRate: number
  fromDate: string
  isAccounting: boolean
  isManagementAccounting: boolean
  organization: Organization
  paymentCurrencyRegister: CreatePaymentCurrencyRegister
  paymentMovement: PaymentMovement
  paymentRegister: CreatePaymentRegister
}

export function buildOutgoingClientReturnPayload({
  amount,
  clientAgreement,
  comment,
  exchangeRate,
  fromDate,
  isAccounting,
  isManagementAccounting,
  organization,
  paymentCurrencyRegister,
  paymentMovement,
  paymentRegister,
}: BuildOutgoingClientReturnPayloadParams): OutcomePaymentOrderCreatePayload {
  return {
    Amount: amount,
    ClientAgreement: clientAgreement,
    Comment: comment.trim(),
    ExchangeRate: exchangeRate || undefined,
    FromDate: fromDate,
    IsAccounting: isAccounting,
    IsManagementAccounting: isManagementAccounting,
    IsUnderReport: false,
    OperationType: OUTCOME_OPERATION_TYPE.BuyerReturn,
    Organization: organization,
    PaymentCurrencyRegister: paymentCurrencyRegister,
    PaymentMovementOperation: {
      PaymentMovement: paymentMovement,
    },
    PaymentRegister: paymentRegister,
  }
}
