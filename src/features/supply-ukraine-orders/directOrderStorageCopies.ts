import type { DirectSupplyOrder } from './types'

export type DirectOrderStorageCopy = {
  hasArrivedDeliveryProtocol?: boolean
  netUid: string
  storage?: string
}

export function getDirectOrderStorageCopies(order: DirectSupplyOrder | null | undefined): DirectOrderStorageCopy[] {
  if (!order) {
    return []
  }

  const copies: DirectOrderStorageCopy[] = []
  const byNetUid = new Map<string, DirectOrderStorageCopy>()

  for (const invoice of order.SupplyInvoices || []) {
    const netUid = normalizeText(invoice.SupplyOrderNetUid) || normalizeText(order.NetUid)

    if (!netUid) {
      continue
    }

    const storage = normalizeText(invoice.ImportedStorageName)
    const hasArrivedDeliveryProtocol = typeof invoice.SupplyOrderHasArrivedDeliveryProtocol === 'boolean'
      ? invoice.SupplyOrderHasArrivedDeliveryProtocol
      : undefined
    const existing = byNetUid.get(netUid.toLowerCase())

    if (existing) {
      existing.storage ||= storage
      existing.hasArrivedDeliveryProtocol ??= hasArrivedDeliveryProtocol
      continue
    }

    const copy: DirectOrderStorageCopy = { netUid, storage }

    if (hasArrivedDeliveryProtocol !== undefined) {
      copy.hasArrivedDeliveryProtocol = hasArrivedDeliveryProtocol
    }

    byNetUid.set(netUid.toLowerCase(), copy)
    copies.push(copy)
  }

  const orderNetUid = normalizeText(order.NetUid)

  if (orderNetUid && !byNetUid.has(orderNetUid.toLowerCase())) {
    copies.unshift({ netUid: orderNetUid, storage: normalizeText(order.ImportedStorageName) })
  }

  return copies
}

export function getDirectOrderStorages(order: DirectSupplyOrder | null | undefined): string[] {
  const storages: string[] = []

  for (const invoice of order?.SupplyInvoices || []) {
    const storage = normalizeText(invoice.ImportedStorageName)

    if (storage && !storages.includes(storage)) {
      storages.push(storage)
    }
  }

  const fallback = normalizeText(order?.ImportedStorageName)

  if (!storages.length && fallback) {
    storages.push(fallback)
  }

  return storages.sort((left, right) => left.localeCompare(right, 'uk-UA'))
}

function normalizeText(value: string | null | undefined): string | undefined {
  const text = typeof value === 'string' ? value.trim() : ''

  return text || undefined
}
