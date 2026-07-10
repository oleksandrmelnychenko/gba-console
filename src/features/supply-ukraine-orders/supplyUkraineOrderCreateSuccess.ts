import {
  createAllOrdersUkraineFilterAfterCreateState,
  resetAllOrdersUkraineFilter,
} from './allOrdersUkraineFilter'
import type {
  SupplyOrderFromFileResponse,
  SupplyOrderUkraineFromFileResponse,
  SupplyUkraineOrdersFilter,
} from './types'

export type SupplyUkraineOrderCreateMode = 'direct' | 'toUkraine'
export type SupplyUkraineOrderUploadResponse = SupplyOrderFromFileResponse | SupplyOrderUkraineFromFileResponse

export type SupplyUkraineOrderCreateNavigation = {
  path: string
  state: Record<string, SupplyUkraineOrdersFilter>
}

export function prepareSupplyUkraineOrderCreateNavigation(
  response: SupplyUkraineOrderUploadResponse,
  mode: SupplyUkraineOrderCreateMode,
  now = new Date(),
): SupplyUkraineOrderCreateNavigation | null {
  if (response.HasError) {
    return null
  }

  const filters = resetAllOrdersUkraineFilter(now)

  return {
    path: getSuccessPath(response, mode),
    state: createAllOrdersUkraineFilterAfterCreateState(filters),
  }
}

function getSuccessPath(response: SupplyUkraineOrderUploadResponse, mode: SupplyUkraineOrderCreateMode): string {
  if (mode === 'toUkraine' && 'SupplyOrderUkraine' in response && response.SupplyOrderUkraine?.NetUid) {
    return `/orders/ukraine/view/${response.SupplyOrderUkraine.NetUid}`
  }

  if (mode === 'direct' && 'SupplyOrder' in response && response.SupplyOrder?.NetUid) {
    return `/orders/ukraine/all/edit/${response.SupplyOrder.NetUid}`
  }

  return '/orders/ukraine/all'
}
