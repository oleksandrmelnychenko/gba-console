import { apiRequest } from '../../../shared/api/apiClient'
import {
  executeAccountingMutation,
  type AccountingMutationOperationOptions,
} from '../../../shared/api/accountingMutationOperation'
import type { OutcomePaymentOrder } from '../types'

const CREATE_SAD_OUTCOME_ENDPOINT = '/payments/orders/outcome/sad/create'
const CREATE_TAX_FREE_OUTCOME_ENDPOINT = '/payments/orders/outcome/tax-free-documents/new'

export async function createOutcomeOrderFromTaxFree(
  taxFreeNetId: string,
  order: OutcomePaymentOrder,
  operation?: AccountingMutationOperationOptions,
): Promise<OutcomePaymentOrder | null> {
  const result = await executeAccountingMutation({
    identity: order,
    kind: 'outcome-payment:add-tax-free',
    operation,
    payload: {
      order,
      taxFreeNetId,
    },
    request: (payload, context) => apiRequest<unknown>(CREATE_TAX_FREE_OUTCOME_ENDPOINT, {
      body: payload.order,
      dedupe: false,
      headers: context.headers,
      method: 'POST',
      query: {
        taxFreeNetId: payload.taxFreeNetId,
      },
      ...(context.signal ? { signal: context.signal } : {}),
    }),
  })

  return result && typeof result === 'object' ? (result as OutcomePaymentOrder) : null
}

function toSadPaymentRequest(order: OutcomePaymentOrder) {
  const movement = order.PaymentMovementOperation?.PaymentMovement
  return {
    amount: order.Amount || 0,
    comment: order.Comment || '',
    fromDate: order.FromDate,
    organizationId: order.Organization?.Id || 0,
    paymentMovementId: movement?.Id || 0,
    clientId: order.ClientAgreement?.ClientId || null,
    clientAgreementId: order.ClientAgreement?.Id || null,
    organizationClientId: order.OrganizationClientAgreement?.OrganizationClientId || null,
    organizationClientAgreementId:
      order.OrganizationClientAgreement?.Id || null,
    paymentRegisterId: 0,
    currencyId: 0,
    paymentCurrencyRegisterId:
      order.PaymentCurrencyRegister?.Id || 0,
  }
}

export async function createOutcomeOrderFromSad(
  sadNetId: string,
  order: OutcomePaymentOrder,
  operation?: AccountingMutationOperationOptions,
): Promise<OutcomePaymentOrder | null> {
  const result = await executeAccountingMutation({
    identity: order,
    kind: 'outcome-payment:add-sad',
    operation,
    payload: {
      order,
      sadNetId,
    },
    request: (payload, context) => apiRequest<unknown>(CREATE_SAD_OUTCOME_ENDPOINT, {
      body: toSadPaymentRequest(payload.order),
      dedupe: false,
      headers: context.headers,
      method: 'POST',
      query: {
        sadNetId: payload.sadNetId,
      },
      ...(context.signal ? { signal: context.signal } : {}),
    }),
  })

  return result && typeof result === 'object' ? (result as OutcomePaymentOrder) : null
}
