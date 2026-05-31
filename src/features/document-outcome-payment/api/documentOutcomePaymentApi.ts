import { apiRequest } from '../../../shared/api/apiClient'
import type { OutcomePaymentOrder } from '../types'

export async function createOutcomeOrderFromTaxFree(
  taxFreeNetId: string,
  order: OutcomePaymentOrder,
): Promise<OutcomePaymentOrder | null> {
  const result = await apiRequest<unknown>('/payments/orders/outcome/new/taxfree', {
    method: 'POST',
    query: {
      taxFreeNetId,
    },
    body: order,
  })

  return result && typeof result === 'object' ? (result as OutcomePaymentOrder) : null
}

export async function createOutcomeOrderFromSad(
  sadNetId: string,
  order: OutcomePaymentOrder,
): Promise<OutcomePaymentOrder | null> {
  const result = await apiRequest<unknown>('/payments/orders/outcome/new/sad', {
    method: 'POST',
    query: {
      sadNetId,
    },
    body: order,
  })

  return result && typeof result === 'object' ? (result as OutcomePaymentOrder) : null
}
