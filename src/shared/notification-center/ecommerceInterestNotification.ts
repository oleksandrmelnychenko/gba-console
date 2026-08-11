import type { PreOrderAddedRealtimeNotification } from '../realtime/events'
import type { ConsoleNotification } from './types'

export function createEcommerceInterestNotification(
  preOrder: PreOrderAddedRealtimeNotification,
  now = new Date(),
): ConsoleNotification | null {
  const preOrderNetUid = preOrder.NetUid?.trim()
  if (!preOrderNetUid) {
    return null
  }

  const contact = (
    preOrder.Client?.FullName
    || preOrder.Client?.MobileNumber
    || preOrder.MobileNumber
  )?.trim()
  const vendorCode = preOrder.Product?.VendorCode?.trim()
  const productName = (preOrder.Product?.NameUA || preOrder.Product?.Name)?.trim()
  const qty = getFiniteNumber(preOrder.Qty)
  const details = [
    vendorCode,
    contact,
    productName,
    qty !== undefined ? `${qty} шт.` : '',
  ].filter(Boolean)

  return {
    createdAt: normalizeCreatedAt(preOrder.Created, now),
    entityNetUid: preOrderNetUid,
    id: `ecommerce-interest:${preOrderNetUid.toLowerCase()}`,
    kind: 'ecommerce-interest',
    message: details.join(' · '),
    route: '/sales/ukraine/interest',
    title: 'Нова зацікавленість з інтернет-магазину',
  }
}

function getFiniteNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeCreatedAt(value: string | undefined, fallback: Date): string {
  if (!value) {
    return fallback.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString()
}
