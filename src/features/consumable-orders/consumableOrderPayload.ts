import type { ConsumablesOrder } from './types'

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function sanitizeConsumableOrderPayload(order: ConsumablesOrder): ConsumablesOrder {
  return stripInvalidNetUids(order) as ConsumablesOrder
}

function stripInvalidNetUids(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripInvalidNetUids)
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const sanitized: Record<string, unknown> = {}

  for (const [key, entryValue] of Object.entries(value)) {
    if (key === 'NetUid') {
      if (typeof entryValue === 'string' && GUID_PATTERN.test(entryValue.trim())) {
        sanitized[key] = entryValue.trim()
      }

      continue
    }

    sanitized[key] = stripInvalidNetUids(entryValue)
  }

  return sanitized
}
