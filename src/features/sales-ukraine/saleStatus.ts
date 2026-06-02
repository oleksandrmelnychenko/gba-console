const SALE_LIFECYCLE_NAME_TO_TYPE: Record<string, number> = {
  all: 6,
  await: 5,
  invoicechanged: 102,
  new: 0,
  orderclosed: 100,
  packaged: 2,
  packaging: 1,
  received: 4,
  shipping: 3,
  transporterchanged: 101,
}

export function getStatusTypeKey(value: number | string | null | undefined): string {
  return value === null || typeof value === 'undefined' ? '' : String(value)
}

export function isStatusType(value: number | string | null | undefined, expected: number): boolean {
  return getStatusTypeKey(value) === String(expected)
}

function getSaleLifecycleTypeKey(value: number | string | null | undefined): string {
  if (value === null || typeof value === 'undefined') {
    return ''
  }

  const key = String(value).trim()
  const type = SALE_LIFECYCLE_NAME_TO_TYPE[key.toLowerCase()]

  return typeof type === 'number' ? String(type) : key
}

export function isDiscountEditableSaleLifecycle(value: number | string | null | undefined): boolean {
  const key = getSaleLifecycleTypeKey(value)

  return key === '0' || key === '1'
}
