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

export type SupplyUkraineOrderCreateNavigationOptions = {
  canOpenDirectOrderLogisticWay?: boolean
  now?: Date
}

export type SupplyUkraineOrderCreateNavigation = {
  path: string
  state: Record<string, SupplyUkraineOrdersFilter>
}

export function prepareSupplyUkraineOrderCreateNavigation(
  response: SupplyUkraineOrderUploadResponse,
  mode: SupplyUkraineOrderCreateMode,
  options: SupplyUkraineOrderCreateNavigationOptions = {},
): SupplyUkraineOrderCreateNavigation | null {
  if (response.HasError) {
    return null
  }

  const now = options.now ?? new Date()
  const filters = resetAllOrdersUkraineFilter(now)

  return {
    path: getSuccessPath(response, mode, options.canOpenDirectOrderLogisticWay ?? true),
    state: createAllOrdersUkraineFilterAfterCreateState(filters),
  }
}

function getSuccessPath(
  response: SupplyUkraineOrderUploadResponse,
  mode: SupplyUkraineOrderCreateMode,
  canOpenDirectOrderLogisticWay: boolean,
): string {
  if (mode === 'toUkraine' && 'SupplyOrderUkraine' in response && response.SupplyOrderUkraine?.NetUid) {
    return `/orders/ukraine/view/${response.SupplyOrderUkraine.NetUid}`
  }

  if (
    mode === 'direct'
    && canOpenDirectOrderLogisticWay
    && 'SupplyOrder' in response
    && response.SupplyOrder?.NetUid
  ) {
    return `/orders/ukraine/all/edit/${response.SupplyOrder.NetUid}`
  }

  return '/orders/ukraine/all'
}
