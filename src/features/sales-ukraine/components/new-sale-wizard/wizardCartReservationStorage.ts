import type { SalesUkraineOrderItem } from '../../types'

/** The rule the server applies when a cart line reserves stock (owner decision, SaleStorageOrder on the server). */
export const RESERVATION_STORAGE_RULE =
  'Склад резерву обирається за «Пріоритетом» складу (менше число — раніше); за однакового пріоритету — спершу основний склад організації, потім склади «Для перепродажу» цієї ж організації.'

export type WizardReservationStorage = {
  name: string
  priority: number
  qty: number
  isReSale: boolean
}

/** Storages a cart line holds stock on, in the order the rule took them; empty when the line has no live reservation. */
export function getReservationStorages(item: Pick<SalesUkraineOrderItem, 'ProductReservations'>): WizardReservationStorage[] {
  const byStorage = new Map<string, WizardReservationStorage>()

  for (const reservation of item.ProductReservations ?? []) {
    const storage = reservation?.ProductAvailability?.Storage
    const qty = typeof reservation?.Qty === 'number' && Number.isFinite(reservation.Qty) ? reservation.Qty : 0
    const name = storage?.Name?.trim()

    if (!name || qty <= 0) continue

    const key = String(reservation.ProductAvailability?.StorageId ?? name)
    const current = byStorage.get(key)

    if (current) {
      current.qty += qty
    } else {
      byStorage.set(key, {
        name,
        priority: typeof storage?.RetailPriority === 'number' ? storage.RetailPriority : 0,
        qty,
        isReSale: Boolean(reservation.IsReSaleReservation ?? storage?.AvailableForReSale),
      })
    }
  }

  return [...byStorage.values()].sort((left, right) => left.priority - right.priority || Number(left.isReSale) - Number(right.isReSale))
}

/** «Резерв: D3 Ресейл 2 (пріоритет 9) — 4; D3 Ресейл (пріоритет 50) — 1», or null without a reservation. */
export function formatReservationStorages(storages: WizardReservationStorage[], formatQty: (qty: number) => string): string | null {
  if (storages.length === 0) return null

  return `Резерв: ${storages
    .map((storage) => `${storage.name} (пріоритет ${storage.priority}${storage.isReSale ? ', для перепродажу' : ''}) — ${formatQty(storage.qty)}`)
    .join('; ')}`
}
