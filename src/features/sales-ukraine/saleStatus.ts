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

export function getSaleLifecycleTypeKey(value: number | string | null | undefined): string {
  if (value === null || typeof value === 'undefined') {
    return ''
  }

  const key = String(value).trim()
  const type = SALE_LIFECYCLE_NAME_TO_TYPE[key.toLowerCase()]

  return typeof type === 'number' ? String(type) : key
}

export function isDiscountEditableSaleLifecycle(value: number | string | null | undefined): boolean {
  return isNewOrPackagingSaleLifecycle(value)
}

export function isPackingAcceptanceSaleLifecycle(value: number | string | null | undefined): boolean {
  return isNewOrPackagingSaleLifecycle(value)
}

export function isDiscountPercentageEditableSaleLifecycle(value: number | string | null | undefined): boolean {
  return getSaleLifecycleTypeKey(value) === '0'
}

export type SaleStockPostingMarker = {
  hint: string
  label: string
  tone: 'danger' | 'warning'
}

const STOCK_POSTING_REASON_HINTS: Record<string, string> = {
  InsufficientStock:
    'Товар за накладною не списано з партій: на складах, з яких дозволено списання за цим договором, не вистачає залишку.',
  PricingUnavailable: 'Товар за накладною не списано з партій: для позиції не визначено ціну за договором.',
  ShiftWithoutMovement: 'Акт зсуву не проведено по складу: його зареєстровано до складського проведення накладної.',
}

const STOCK_POSTING_CONSEQUENCE = 'Резерв утримується, собівартості немає, повернення за накладною недоступне.'

/**
 * Marker for an invoice whose stock has not moved. The server reports the state of its stock posting —
 * the same condition the return form words as «Складське проведення не завершено».
 */
export function getSaleStockPostingMarker(sale: {
  StockPostingReason?: string | null
  StockPostingState?: string | null
}): SaleStockPostingMarker | null {
  const state = String(sale.StockPostingState ?? '').trim().toLowerCase()

  if (state !== 'pending' && state !== 'failed') {
    return null
  }

  const failed = state === 'failed'
  const reason = STOCK_POSTING_REASON_HINTS[String(sale.StockPostingReason ?? '').trim()]
    ?? (failed ? 'Товар за накладною не списано з партій.' : 'Складське списання за накладною ще в черзі.')

  return failed
    ? {
        hint: `${reason} ${STOCK_POSTING_CONSEQUENCE} Автоматичні спроби вичерпано — зверніться до адміністратора.`,
        label: 'Складське проведення не виконано',
        tone: 'danger',
      }
    : {
        hint: `${reason} ${STOCK_POSTING_CONSEQUENCE} Проведення повторюється автоматично.`,
        label: 'Складське проведення не завершено',
        tone: 'warning',
      }
}

function isNewOrPackagingSaleLifecycle(value: number | string | null | undefined): boolean {
  const key = getSaleLifecycleTypeKey(value)

  return key === '0' || key === '1'
}
