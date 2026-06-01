import type { SalesUkraineClientAgreement, SalesUkraineSale } from '../../types'

export type NewSaleWizardStepIndex = 0 | 1 | 2

export type NewSaleWizardState = {
  agreement: SalesUkraineClientAgreement | null
  agreementNetId: string | null
  clientNetId: string | null
  sale: SalesUkraineSale | null
}

export const NEW_SALE_WIZARD_INITIAL: NewSaleWizardState = {
  agreement: null,
  agreementNetId: null,
  clientNetId: null,
  sale: null,
}

export function canAdvanceToProducts(state: NewSaleWizardState): boolean {
  return Boolean(state.clientNetId && state.agreementNetId)
}

export function canAdvanceToReview(state: NewSaleWizardState): boolean {
  return Boolean(state.sale?.NetUid)
}

export function getCartItemCount(sale: SalesUkraineSale | null): number {
  return Array.isArray(sale?.Order?.OrderItems) ? sale.Order.OrderItems.length : 0
}
