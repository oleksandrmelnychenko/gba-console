export type SupplyUkraineOrderNumberSource = {
  InvNumber?: string | null
  NetUid?: string | null
  Number?: string | null
}

export type DirectSupplyOrderNumberSource = {
  Number?: string | null
  SupplyInvoices?: Array<{ Number?: string | null }> | null
  SupplyOrderNumber?: { Number?: string | null } | null
  SupplyProForm?: { Number?: string | null } | null
}

export function getSupplyUkraineOrderDisplayNumber(
  order?: SupplyUkraineOrderNumberSource | null,
): string | undefined {
  if (!order) {
    return undefined
  }

  return normalizeDisplayNumber(order.Number)
    || normalizeDisplayNumber(order.InvNumber)
    || normalizeDisplayNumber(order.NetUid)
}

export function getDirectSupplyOrderDisplayNumber(
  order?: DirectSupplyOrderNumberSource | null,
): string | undefined {
  if (!order) {
    return undefined
  }

  return normalizeDisplayNumber(order.SupplyOrderNumber?.Number)
    || normalizeDisplayNumber(order.SupplyProForm?.Number)
    || normalizeDisplayNumber(order.SupplyInvoices?.find((invoice) => normalizeDisplayNumber(invoice.Number))?.Number)
    || normalizeDisplayNumber(order.Number)
}

export function normalizeDisplayNumber(value?: string | null): string | undefined {
  const normalizedValue = value?.trim()

  if (!normalizedValue || /^0+$/.test(normalizedValue)) {
    return undefined
  }

  return normalizedValue
}
