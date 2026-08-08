import type { SaleAddedRealtimeNotification } from '../realtime/events'
import type { ConsoleNotification } from './types'

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function createEcommerceOrderNotification(
  payload: SaleAddedRealtimeNotification,
  now = new Date(),
): ConsoleNotification | null {
  const sale = payload.Sale
  if (!sale) {
    return null
  }

  const orderSource = sale?.Order?.OrderSource
  const isShopOrder = orderSource === 0 || orderSource === '0' || orderSource === 'Shop'
  const saleNetUid = sale?.NetUid?.trim()

  if (!isShopOrder || !saleNetUid) {
    return null
  }

  const saleNumber = sale.SaleNumber?.Value?.trim()
  const clientName = (
    sale.RetailClient?.FullName
    || sale.RetailClient?.Name
    || sale.ClientAgreement?.Client?.FullName
  )?.trim()
  const currencyCode = sale.ClientAgreement?.Agreement?.Currency?.Code?.trim()
  const amount = getFiniteNumber(sale.TotalAmountLocal ?? sale.Order?.TotalAmountLocal)
  const reportedPositions = getFiniteNumber(sale.TotalPositions)
  const orderItemPositions = sale.Order?.OrderItems?.length
  const positions = reportedPositions !== undefined && reportedPositions > 0
    ? reportedPositions
    : orderItemPositions ?? reportedPositions
  const details = [
    saleNumber,
    clientName,
    amount !== undefined ? `${amountFormatter.format(amount)} ${currencyCode || ''}`.trim() : '',
    positions !== undefined ? `${positions} поз.` : '',
  ].filter(Boolean)

  return {
    createdAt: normalizeCreatedAt(sale.Created, now),
    entityNetUid: saleNetUid,
    id: `ecommerce-order:${saleNetUid.toLowerCase()}`,
    kind: 'ecommerce-order',
    message: details.join(' · '),
    route: '/sales-online-shop',
    title: 'Нове замовлення з інтернет-магазину',
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
