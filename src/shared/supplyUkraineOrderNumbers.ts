export type SupplyUkraineOrderNumberSource = {
  InvNumber?: string | null
  NetUid?: string | null
  Number?: string | null
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

export function normalizeDisplayNumber(value?: string | null): string | undefined {
  const normalizedValue = value?.trim()

  if (!normalizedValue || /^0+$/.test(normalizedValue)) {
    return undefined
  }

  return normalizedValue
}
