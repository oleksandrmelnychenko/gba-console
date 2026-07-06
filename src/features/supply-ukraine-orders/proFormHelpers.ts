import type { DirectSupplyOrder } from './types'

/**
 * Whether a direct supply order carries a saved proforma. Mirrors the proforma
 * card's broad check so the logistics/invoice gate does not hide when the list
 * (or an update response) returns the nested SupplyProForm object without a
 * flattened SupplyProFormId — which made a saved proforma look like it vanished
 * on the logistics step (bug #26).
 */
export function hasSupplyProForm(
  order: Pick<DirectSupplyOrder, 'SupplyProFormId' | 'SupplyProForm'> | null | undefined,
): boolean {
  return Boolean(order?.SupplyProFormId || order?.SupplyProForm?.NetUid || order?.SupplyProForm?.Id)
}
