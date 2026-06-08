import type { ShipmentList, ShipmentSale } from './shipmentTypes'

export function getShipmentSaleKey(sale?: Pick<ShipmentSale, 'Id' | 'NetUid'> | null): string {
  return sale?.NetUid || (typeof sale?.Id === 'number' ? String(sale.Id) : '')
}

export function appendManualShipmentSales(
  shipmentList: ShipmentList,
  sales: ShipmentSale[],
  qtyPlacesBySaleKey: Record<string, string | number | undefined> = {},
) {
  const existingSaleKeys = new Set(
    shipmentList.ShipmentListItems.map((item) => getShipmentSaleKey(item.Sale)).filter(Boolean),
  )
  let skippedDuplicateCount = 0
  let skippedInvalidCount = 0

  const additions = sales.reduce<ShipmentList['ShipmentListItems']>((items, sale) => {
    const saleKey = getShipmentSaleKey(sale)

    if (!saleKey) {
      skippedInvalidCount += 1
      return items
    }

    if (existingSaleKeys.has(saleKey)) {
      skippedDuplicateCount += 1
      return items
    }

    existingSaleKeys.add(saleKey)
    items.push({
      IsDirty: true,
      QtyPlaces: normalizeQtyPlaces(qtyPlacesBySaleKey[saleKey]),
      Sale: sale,
    })

    return items
  }, [])

  return {
    appendedCount: additions.length,
    shipmentList: additions.length
      ? { ...shipmentList, ShipmentListItems: [...shipmentList.ShipmentListItems, ...additions] }
      : shipmentList,
    skippedDuplicateCount,
    skippedInvalidCount,
  }
}

export function isValidManualQtyPlaces(value: string | number | undefined): boolean {
  if (typeof value === 'undefined' || value === '') {
    return true
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10)

  return Number.isFinite(parsed) && parsed >= 0
}

export function toManualShipmentQueryDate(value: string): string {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return ''
  }

  const dateInputMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const date = dateInputMatch
    ? new Date(Number(dateInputMatch[1]), Number(dateInputMatch[2]) - 1, Number(dateInputMatch[3]))
    : new Date(trimmedValue)

  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

function normalizeQtyPlaces(value: string | number | undefined): number {
  if (typeof value === 'undefined' || value === '') {
    return 0
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10)

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}
