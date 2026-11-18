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
  settlementRate,
}: {
  /** An override key holder's EUR rate choice for a supplier payment on a client agreement. */
  settlementRate?: { kind: 1 | 2 | null, rate: number | null }
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

    // «Курс у EUR» of a supplier payment: sent only when chosen; the server honours it only with
    // accounting.outgoing_cashflows.order.override_settlement_rate.
    if (operationType === OUTCOME_OPERATION_TYPE.PaymentToSupplier && selectedClientAgreement) {
      if (settlementRate?.kind) {
        payload.EuroRateKind = settlementRate.kind
      }

      if (settlementRate?.rate) {
        payload.EuroExchangeRate = settlementRate.rate
      }
    }
  }

  return payload
}
