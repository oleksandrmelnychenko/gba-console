import { apiRequest } from '../../../shared/api/apiClient'
import {
  executeAccountingMutation,
  type AccountingMutationOperationOptions,
} from '../../../shared/api/accountingMutationOperation'
import {
  ACCOUNTING_OPERATION_ID,
  getAccountingOperation,
} from '../../accounting/accountingOperationCatalog'
import type { OutcomePaymentOrder } from '../types'

const CREATE_SAD_OUTCOME_ENDPOINT =
  getAccountingOperation(ACCOUNTING_OPERATION_ID.SadOutcome).endpoint
const CREATE_TAX_FREE_OUTCOME_ENDPOINT =
  getAccountingOperation(ACCOUNTING_OPERATION_ID.TaxFreeOutcome).endpoint

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
      body: payload.order,
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
