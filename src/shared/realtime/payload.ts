export function parseRealtimePayload<T = unknown>(payload: unknown): T {
  if (typeof payload !== 'string') {
    return payload as T
  }

  try {
    return JSON.parse(payload) as T
  } catch {
    return payload as T
  }
}

export function getStringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function getNumberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value)

    return Number.isFinite(parsedValue) ? parsedValue : undefined
  }

  return undefined
}
