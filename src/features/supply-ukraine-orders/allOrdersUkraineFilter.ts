import { formatLocalDate } from '../../shared/date/dateTime'
import type { SupplyUkraineOrderKind, SupplyUkraineOrdersFilter } from './types'

export const ALL_ORDERS_UKRAINE_FILTER_STORAGE_KEY = 'allOrdersUkraineFilter'

const CREATE_SUCCESS_FILTER_STATE_KEY = 'allOrdersUkraineFilterAfterCreate'

export function createDefaultAllOrdersUkraineFilter(now = new Date()): SupplyUkraineOrdersFilter {
  const fromDate = new Date(now)
  fromDate.setDate(fromDate.getDate() - 7)

  return {
    currencyId: '',
    from: formatLocalDate(fromDate),
    supplier: '',
    to: formatLocalDate(now),
    type: 'all',
  }
}

export function readAllOrdersUkraineFilter(fallback: SupplyUkraineOrdersFilter): SupplyUkraineOrdersFilter {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const rawValue = window.localStorage.getItem(ALL_ORDERS_UKRAINE_FILTER_STORAGE_KEY)

    if (!rawValue) {
      return fallback
    }

    const savedValue = JSON.parse(rawValue) as Partial<SupplyUkraineOrdersFilter>

    return {
      currencyId: typeof savedValue.currencyId === 'string' ? savedValue.currencyId : fallback.currencyId,
      from: isDateInputValue(savedValue.from) ? savedValue.from : fallback.from,
      supplier: typeof savedValue.supplier === 'string' ? savedValue.supplier : fallback.supplier,
      to: isDateInputValue(savedValue.to) ? savedValue.to : fallback.to,
      type: isOrderKind(savedValue.type) ? savedValue.type : fallback.type,
    }
  } catch {
    return fallback
  }
}

export function saveAllOrdersUkraineFilter(filters: SupplyUkraineOrdersFilter): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    window.localStorage.setItem(ALL_ORDERS_UKRAINE_FILTER_STORAGE_KEY, JSON.stringify(filters))
    return true
  } catch {
    return false
  }
}

export function resetAllOrdersUkraineFilter(now = new Date()): SupplyUkraineOrdersFilter {
  const filters = createDefaultAllOrdersUkraineFilter(now)
  saveAllOrdersUkraineFilter(filters)

  return filters
}

export function createAllOrdersUkraineFilterAfterCreateState(
  filters: SupplyUkraineOrdersFilter,
): Record<string, SupplyUkraineOrdersFilter> {
  return { [CREATE_SUCCESS_FILTER_STATE_KEY]: filters }
}

export function readAllOrdersUkraineFilterAfterCreateState(state: unknown): SupplyUkraineOrdersFilter | null {
  if (!isRecord(state)) {
    return null
  }

  const filters = state[CREATE_SUCCESS_FILTER_STATE_KEY]
  return isSupplyUkraineOrdersFilter(filters) ? filters : null
}

export function clearAllOrdersUkraineFilterAfterCreateState(state: unknown): Record<string, unknown> | null {
  if (!isRecord(state)) {
    return null
  }

  const nextState = { ...state }
  delete nextState[CREATE_SUCCESS_FILTER_STATE_KEY]

  return Object.keys(nextState).length > 0 ? nextState : null
}

function isSupplyUkraineOrdersFilter(value: unknown): value is SupplyUkraineOrdersFilter {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.currencyId === 'string'
    && isDateInputValue(value.from)
    && typeof value.supplier === 'string'
    && isDateInputValue(value.to)
    && isOrderKind(value.type)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDateInputValue(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isOrderKind(value: unknown): value is SupplyUkraineOrderKind {
  return value === 'all' || value === 'direct' || value === 'toUkraine'
}
