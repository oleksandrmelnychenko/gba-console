import type { SalesUkraineClientAgreement, SalesUkraineSale, SalesUkraineTransporter } from '../../types'
import type { WizardDeliveryRecipient, WizardDeliveryRecipientAddress } from './newSaleWizardApi'

export const SELF_CHECKOUT_CLASS = 'self_checkout_item_class'

export type NewSaleReviewValue = {
  address: WizardDeliveryRecipientAddress | null
  comment: string
  recipient: WizardDeliveryRecipient | null
  transporter: SalesUkraineTransporter | null
}

export const NEW_SALE_REVIEW_INITIAL: NewSaleReviewValue = {
  address: null,
  comment: '',
  recipient: null,
  transporter: null,
}

export function isSelfCheckout(transporter: SalesUkraineTransporter | null): boolean {
  return transporter?.CssClass === SELF_CHECKOUT_CLASS
}

export function getReviewError(value: NewSaleReviewValue): string | null {
  if (isSelfCheckout(value.transporter)) {
    return null
  }

  if (!value.transporter) {
    return 'Оберіть перевізника'
  }

  if (!value.recipient) {
    return 'Оберіть отримувача'
  }

  return null
}

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
