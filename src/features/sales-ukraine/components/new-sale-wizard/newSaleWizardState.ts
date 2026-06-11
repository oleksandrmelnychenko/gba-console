import { useSyncExternalStore } from 'react'
import type { SalesUkraineClientAgreement, SalesUkraineSale, SalesUkraineTransporter } from '../../types'
import type { WizardSplitOrderItem } from './EditShoppingCartOverlay'
import type { WizardDeliveryRecipient, WizardDeliveryRecipientAddress } from './newSaleWizardApi'

export const SELF_CHECKOUT_CLASS = 'self_checkout_item_class'

export type NewSaleReviewValue = {
  address: WizardDeliveryRecipientAddress | null
  addressValue: string
  city: string
  codAmount: number | string
  comment: string
  department: string
  hasOwnTtn: boolean
  isNewAddress: boolean
  isNewRecipient: boolean
  isCashOnDelivery: boolean
  mobilePhone: string
  recipient: WizardDeliveryRecipient | null
  recipientName: string
  transporter: SalesUkraineTransporter | null
  ttnFile: File | null
  ttnNumber: string
}

export const NEW_SALE_REVIEW_INITIAL: NewSaleReviewValue = {
  address: null,
  addressValue: '',
  city: '',
  codAmount: '',
  comment: '',
  department: '',
  hasOwnTtn: false,
  isNewAddress: false,
  isNewRecipient: false,
  isCashOnDelivery: false,
  mobilePhone: '',
  recipient: null,
  recipientName: '',
  transporter: null,
  ttnFile: null,
  ttnNumber: '',
}

export function isSelfCheckout(transporter: SalesUkraineTransporter | null): boolean {
  return transporter?.CssClass === SELF_CHECKOUT_CLASS
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

let splitOrderItems: WizardSplitOrderItem[] = []

const splitOrderItemsListeners = new Set<() => void>()

export function getWizardSplitOrderItems(): WizardSplitOrderItem[] {
  return splitOrderItems
}

export function hasWizardSplitOrderItems(): boolean {
  return splitOrderItems.length > 0
}

export function setWizardSplitOrderItems(items: WizardSplitOrderItem[]): void {
  splitOrderItems = items
  splitOrderItemsListeners.forEach((listener) => listener())
}

export function clearWizardSplitOrderItems(): void {
  if (splitOrderItems.length > 0) {
    setWizardSplitOrderItems([])
  }
}

export function subscribeWizardSplitOrderItems(listener: () => void): () => void {
  splitOrderItemsListeners.add(listener)

  return () => {
    splitOrderItemsListeners.delete(listener)
  }
}

export function useWizardSplitOrderItems(): WizardSplitOrderItem[] {
  return useSyncExternalStore(subscribeWizardSplitOrderItems, getWizardSplitOrderItems)
}

let debtRefreshVersion = 0

const debtRefreshListeners = new Set<() => void>()

export function getWizardDebtRefreshVersion(): number {
  return debtRefreshVersion
}

export function bumpWizardDebtRefresh(): void {
  debtRefreshVersion += 1
  debtRefreshListeners.forEach((listener) => listener())
}

export function subscribeWizardDebtRefresh(listener: () => void): () => void {
  debtRefreshListeners.add(listener)

  return () => {
    debtRefreshListeners.delete(listener)
  }
}

export function useWizardDebtRefreshVersion(): number {
  return useSyncExternalStore(subscribeWizardDebtRefresh, getWizardDebtRefreshVersion)
}
