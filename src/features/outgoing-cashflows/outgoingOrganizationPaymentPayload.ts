import type {
  Organization,
  PaymentMovement,
  SupplyOrganization,
  SupplyOrganizationAgreement,
} from '../income-cashflows/types'
import {
  type CreatePaymentCurrencyRegister,
  type CreatePaymentRegister,
  OUTCOME_OPERATION_TYPE,
  type OutcomePaymentOrderCreatePayload,
} from './outgoingCreateTypes'

export function buildOutgoingOrganizationPaymentPayload({
  amount,
  comment,
  exchangeRate,
  fromDate,
  isAccounting,
  isManagementAccounting,
  organization,
  paymentCurrencyRegister,
  paymentMovement,
  paymentRegister,
  supplyOrganization,
  supplyOrganizationAgreement,
}: {
  amount: number
  comment: string
  exchangeRate: number
  fromDate: string
  isAccounting: boolean
  isManagementAccounting: boolean
  organization: Organization
  paymentCurrencyRegister: CreatePaymentCurrencyRegister
  paymentMovement: PaymentMovement
  paymentRegister: CreatePaymentRegister
  supplyOrganization: SupplyOrganization
  supplyOrganizationAgreement: SupplyOrganizationAgreement
}): OutcomePaymentOrderCreatePayload {
  return {
    Amount: amount,
    Comment: comment.trim(),
    ConsumableProductOrganization: supplyOrganization,
    ExchangeRate: exchangeRate || undefined,
    FromDate: fromDate,
    IsAccounting: isAccounting,
    IsManagementAccounting: isManagementAccounting,
    IsUnderReport: false,
    OperationType: OUTCOME_OPERATION_TYPE.PaymentToSupplier,
    Organization: organization,
    PaymentCurrencyRegister: paymentCurrencyRegister,
    PaymentMovementOperation: {
      PaymentMovement: paymentMovement,
    },
    PaymentRegister: paymentRegister,
    SupplyOrganizationAgreement: supplyOrganizationAgreement,
  }
}
