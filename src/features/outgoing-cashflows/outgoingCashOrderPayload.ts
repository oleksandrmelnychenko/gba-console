import type { Organization, PaymentMovement } from './types'
import {
  type CreateFormState,
  type CreatePaymentCurrencyRegister,
  type CreatePaymentRegister,
  OUTCOME_OPERATION_TYPE,
  type OutcomePaymentOrderCreatePayload,
  type OutcomePaymentUser,
} from './outgoingCreateTypes'
import { toIsoDateTime } from './components/outgoingModeShared'

export function buildOutgoingCashOrderPayload({
  colleague,
  form,
  selectedCurrencyRegister,
  selectedMovement,
  selectedOrganization,
  selectedRegister,
}: {
  colleague: OutcomePaymentUser | null
  form: CreateFormState
  selectedCurrencyRegister: CreatePaymentCurrencyRegister
  selectedMovement: PaymentMovement
  selectedOrganization: Organization
  selectedRegister: CreatePaymentRegister
}): OutcomePaymentOrderCreatePayload {
  const invoiceNumber = form.invoiceNumber.trim()

  return {
    Amount: form.amount,
    Colleague: colleague,
    Comment: form.comment.trim(),
    FromDate: toIsoDateTime(form.date, form.time),
    IsAccounting: form.isAccounting,
    IsManagementAccounting: form.isManagementAccounting,
    IsUnderReport: true,
    OperationType: OUTCOME_OPERATION_TYPE.TransferToColleague,
    Organization: selectedOrganization,
    PaymentCurrencyRegister: selectedCurrencyRegister,
    PaymentMovementOperation: {
      PaymentMovement: selectedMovement,
    },
    PaymentPurpose: form.paymentPurpose.trim(),
    PaymentRegister: selectedRegister,
    ...(invoiceNumber ? { ArrivalNumber: invoiceNumber } : {}),
  }
}
