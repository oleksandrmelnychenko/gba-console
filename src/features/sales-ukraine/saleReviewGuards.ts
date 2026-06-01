import type { SalesUkraineSale } from './types'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const SELF_CHECKOUT_CLASS = 'self_checkout_item_class'

export type SaleReviewIssueCode =
  | 'cashOnDeliveryAmount'
  | 'deliveryAddress'
  | 'ownTtnNumber'
  | 'recipient'
  | 'recipientPhone'
  | 'transporter'

export function getSaleReviewIssues(sale: SalesUkraineSale): SaleReviewIssueCode[] {
  const issues: SaleReviewIssueCode[] = []
  const transporter = sale.Transporter

  if (!hasEntityIdentity(transporter)) {
    issues.push('transporter')
  }

  if (!isSelfCheckoutTransporter(sale)) {
    const recipient = sale.DeliveryRecipient

    if (!hasEntityIdentity(recipient) && !hasText(recipient?.FullName)) {
      issues.push('recipient')
    }

    if (!hasText(recipient?.MobilePhone)) {
      issues.push('recipientPhone')
    }

    const address = sale.DeliveryRecipientAddress

    if (!hasEntityIdentity(address) && !hasText(address?.Value) && !hasText(address?.City) && !hasText(address?.Department)) {
      issues.push('deliveryAddress')
    }
  }

  if (sale.IsCashOnDelivery && !isPositiveNumber(sale.CashOnDeliveryAmount)) {
    issues.push('cashOnDeliveryAmount')
  }

  if (sale.CustomersOwnTtn && !hasText(sale.CustomersOwnTtn.Number)) {
    issues.push('ownTtnNumber')
  }

  return issues
}

function isSelfCheckoutTransporter(sale: SalesUkraineSale): boolean {
  return sale.Transporter?.CssClass === SELF_CHECKOUT_CLASS
}

function hasEntityIdentity(entity: { Id?: number; NetUid?: string } | null | undefined): boolean {
  if (!entity) {
    return false
  }

  if (typeof entity.Id === 'number' && entity.Id > 0) {
    return true
  }

  return hasText(entity.NetUid) && entity.NetUid !== EMPTY_GUID
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim())
}

function isPositiveNumber(value: number | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}
