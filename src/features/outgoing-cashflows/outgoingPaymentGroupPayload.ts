import { buildConsumableOrderPaymentLinks } from '../consumable-orders/paymentPayload'
import type { ConsumablesOrder } from '../consumable-orders/types'
import type {
  Client,
  ClientAgreement,
  Organization,
  PaymentMovement,
  SupplyOrganization,
  SupplyOrganizationAgreement,
} from '../income-cashflows/types'
import {
  OUTCOME_OPERATION_TYPE,
  type CreatePaymentCurrencyRegister,
  type CreatePaymentRegister,
  type OutcomeOperationType,
  type OutcomePaymentOrderCreatePayload,
} from './outgoingCreateTypes'
import { toIsoDateTime } from './components/outgoingModeShared'

export type OutgoingPaymentGroupPayloadForm = {
  amount: number
  comment: string
  date: string
  exchangeRate: number
  isAccounting: boolean
  isManagementAccounting: boolean
  paymentPurpose: string
  time: string
  vatAmount: number
  vatRate: number
}

export function buildOutgoingPaymentGroupPayload({
  form,
  operationType,
  selectedClient,
  selectedClientAgreement,
  selectedCurrencyRegister,
  selectedMovement,
  selectedOrganization,
  selectedRegister,
  selectedSupplyAgreement,
  selectedSupplyOrganization,
  selectedUnpaidOrders,
}: {
  form: OutgoingPaymentGroupPayloadForm
  operationType: OutcomeOperationType
  selectedClient: Client | null
  selectedClientAgreement: ClientAgreement | null
  selectedCurrencyRegister: CreatePaymentCurrencyRegister
  selectedMovement: PaymentMovement
  selectedOrganization: Organization
  selectedRegister: CreatePaymentRegister
  selectedSupplyAgreement: SupplyOrganizationAgreement | null
  selectedSupplyOrganization: SupplyOrganization | null
  selectedUnpaidOrders: ConsumablesOrder[]
}): OutcomePaymentOrderCreatePayload {
  const payload: OutcomePaymentOrderCreatePayload = {
    Amount: form.amount,
    Comment: form.comment.trim(),
    ExchangeRate: form.exchangeRate || undefined,
    FromDate: toIsoDateTime(form.date, form.time),
    IsAccounting: form.isAccounting,
    IsManagementAccounting: form.isManagementAccounting,
    IsUnderReport: false,
    OperationType: operationType,
    Organization: selectedOrganization,
    PaymentCurrencyRegister: selectedCurrencyRegister,
    PaymentMovementOperation: {
      PaymentMovement: selectedMovement,
    },
    PaymentPurpose: form.paymentPurpose.trim(),
    PaymentRegister: selectedRegister,
    VAT: form.vatAmount || 0,
    VatPercent: form.vatRate,
  }

  if (operationType === OUTCOME_OPERATION_TYPE.OtherOutcome) {
    if (selectedSupplyOrganization && !selectedClient) {
      payload.ConsumableProductOrganization = selectedSupplyOrganization
      if (selectedUnpaidOrders.length > 0) {
        payload.OutcomePaymentOrderConsumablesOrders =
          buildConsumableOrderPaymentLinks(selectedUnpaidOrders, form.amount)
      }
    } else if (selectedClient && !selectedSupplyOrganization) {
      payload.Client = selectedClient
    }

    return payload
  }

  if (selectedSupplyOrganization) {
    payload.ConsumableProductOrganization = selectedSupplyOrganization
    payload.SupplyOrganizationAgreement = selectedSupplyAgreement || undefined
    if (selectedUnpaidOrders.length > 0) {
      payload.OutcomePaymentOrderConsumablesOrders =
        buildConsumableOrderPaymentLinks(selectedUnpaidOrders, form.amount)
    }
  } else if (selectedClient) {
    payload.ClientAgreement = selectedClientAgreement || undefined
  }

  return payload
}
