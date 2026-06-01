import type { SalesUkraineRetailPaymentStatus, SalesUkraineSale } from './types'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const SELF_CHECKOUT_CLASS = 'self_checkout_item_class'

export type SaleReviewIssueCode =
  | 'cashOnDeliveryAmount'
  | 'ownTtnNumber'
  | 'recipient'
  | 'recipientPhone'
  | 'retailPaymentAmount'
  | 'retailPaymentStatus'
  | 'transporter'

export type SaleReviewContext = {
  isRetailPaymentLoading?: boolean
  retailPaymentStatus?: SalesUkraineRetailPaymentStatus | null
}

export function getSaleReviewIssues(sale: SalesUkraineSale, context: SaleReviewContext = {}): SaleReviewIssueCode[] {
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

  }

  if (sale.IsCashOnDelivery && !isPositiveNumber(sale.CashOnDeliveryAmount)) {
    issues.push('cashOnDeliveryAmount')
  }

  if (sale.CustomersOwnTtn && !hasText(sale.CustomersOwnTtn.Number)) {
    issues.push('ownTtnNumber')
  }

  if (sale.RetailClient) {
    const retailPaymentStatus = context.retailPaymentStatus

    if (context.isRetailPaymentLoading || !hasEntityIdentity(retailPaymentStatus)) {
      issues.push('retailPaymentStatus')
    } else if (!isPositiveNumber(retailPaymentStatus?.Amount)) {
      issues.push('retailPaymentAmount')
    }
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
