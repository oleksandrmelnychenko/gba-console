import type { ConsumablesOrder } from './types'

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function sanitizeConsumableOrderPayload(order: ConsumablesOrder): ConsumablesOrder {
  const sanitized = stripLocalIdentities(order) as ConsumablesOrder

  if (!Number.isInteger(order.Id) || Number(order.Id) <= 0) {
    delete sanitized.SupplyPaymentTaskId
  }

  return sanitized
}

function stripLocalIdentities(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripLocalIdentities)
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const sanitized: Record<string, unknown> = {}

  for (const [key, entryValue] of Object.entries(value)) {
    if (key === 'Id') {
      if (typeof entryValue === 'number' && Number.isInteger(entryValue) && entryValue > 0) {
        sanitized[key] = entryValue
      }

      continue
    }

    if (key === 'NetUid') {
      if (typeof entryValue === 'string' && GUID_PATTERN.test(entryValue.trim())) {
        sanitized[key] = entryValue.trim()
      }

      continue
    }

    sanitized[key] = stripLocalIdentities(entryValue)
  }

  return sanitized
}
