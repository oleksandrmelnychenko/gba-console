import { notifications } from '@mantine/notifications'
import type { ProductCapitalizationItem } from './types'

const SUBMIT_NOTICE_ID = 'product-capitalization-submit'

/* Repeated clicks on «Провести» replace one notice instead of stacking copies (WH2-16). */
export function showSubmitNotice({ color, message }: { color: string; message: string }) {
  notifications.hide(SUBMIT_NOTICE_ID)
  notifications.show({ color, id: SUBMIT_NOTICE_ID, message })
}

/** Imported rows may carry -2 / -0.5 / -10: they are shown with the minus and block posting. */
export function hasNegativeValue(item: Pick<ProductCapitalizationItem, 'Qty' | 'UnitPrice' | 'Weight'>): boolean {
  return [item.Qty, item.UnitPrice, item.Weight].some((value) => typeof value === 'number' && value < 0)
}
