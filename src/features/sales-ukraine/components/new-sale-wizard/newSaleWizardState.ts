import type { SalesUkraineClientAgreement, SalesUkraineSale, SalesUkraineTransporter } from '../../types'
import type { WizardDeliveryRecipient, WizardDeliveryRecipientAddress } from './newSaleWizardApi'

export const SELF_CHECKOUT_CLASS = 'self_checkout_item_class'

export type NewSaleReviewValue = {
  address: WizardDeliveryRecipientAddress | null
  city: string
  codAmount: number | string
  comment: string
  department: string
  hasOwnTtn: boolean
  isCashOnDelivery: boolean
  mobilePhone: string
  recipient: WizardDeliveryRecipient | null
  transporter: SalesUkraineTransporter | null
  ttnFile: File | null
  ttnNumber: string
}

export const NEW_SALE_REVIEW_INITIAL: NewSaleReviewValue = {
  address: null,
  city: '',
  codAmount: '',
  comment: '',
  department: '',
  hasOwnTtn: false,
  isCashOnDelivery: false,
  mobilePhone: '',
  recipient: null,
  transporter: null,
  ttnFile: null,
  ttnNumber: '',
}

export function isSelfCheckout(transporter: SalesUkraineTransporter | null): boolean {
  return transporter?.CssClass === SELF_CHECKOUT_CLASS
}

export function getReviewError(value: NewSaleReviewValue): string | null {
  if (!value.transporter) {
    return 'Оберіть перевізника'
  }

  if (!isSelfCheckout(value.transporter)) {
    if (!value.recipient) {
      return 'Оберіть отримувача'
    }

    if (!value.address) {
      return 'Оберіть адресу доставки'
    }

    if (!value.mobilePhone.trim()) {
      return 'Вкажіть мобільний телефон отримувача'
    }
  }

  if (value.isCashOnDelivery && !(parseReviewAmount(value.codAmount) > 0)) {
    return 'Вкажіть суму накладеного платежу'
  }

  if (value.hasOwnTtn && !value.ttnNumber.trim()) {
    return 'Вкажіть номер ТТН'
  }

  return null
}

function parseReviewAmount(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : 0
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
