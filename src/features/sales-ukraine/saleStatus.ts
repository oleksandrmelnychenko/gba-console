const SALE_LIFECYCLE_NAME_TO_TYPE: Record<string, number> = {
  all: 6,
  await: 5,
  invoicechanged: 102,
  new: 0,
  orderclosed: 100,
  packaged: 2,
  packaging: 1,
  received: 4,
  salelifecycleall: 6,
  salelifecycleawait: 5,
  salelifecyclenew: 0,
  salelifecyclepackaged: 2,
  salelifecyclepackaging: 1,
  salelifecyclereceived: 4,
  salelifecycleshipping: 3,
  shipping: 3,
  transporterchanged: 101,
}

export function getStatusTypeKey(value: number | string | null | undefined): string {
  return value === null || typeof value === 'undefined' ? '' : String(value)
}

export function isStatusType(value: number | string | null | undefined, expected: number): boolean {
  return getStatusTypeKey(value) === String(expected)
}

export function getSaleLifecycleStatusKey(value: number | string | null | undefined): string {
  const key = getSaleLifecycleTypeKey(value)

  switch (key) {
    case '0':
      return 'New'
    case '1':
      return 'Packaging'
    case '2':
      return 'Packaged'
    case '3':
      return 'Shipping'
    case '4':
      return 'Received'
    case '5':
      return 'Await'
    case '6':
      return 'All'
    case '100':
      return 'OrderClosed'
    case '101':
      return 'TransporterChanged'
    case '102':
      return 'InvoiceChanged'
    default:
      return key
  }
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

  return key === '0'
}
