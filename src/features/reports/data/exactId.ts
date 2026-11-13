
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const aliases = (value: object, name: string) => Object.keys(value).filter(key => key.toLowerCase() === name.toLowerCase())
const aliasKeys = aliases
/** Inspect top-level JSON keys before parsing; JSON.parse alone discards duplicate Id properties. */
function uniqueJsonIdKey(raw: string): boolean {
  let depth = 0, count = 0
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index]
    if (character === '{' || character === '[') depth += 1
    else if (character === '}' || character === ']') depth -= 1
    else if (character === '"') {
      const start = index
      for (index += 1; index < raw.length; index += 1) {
        if (raw[index] === '\\') index += 1
        else if (raw[index] === '"') break
      }
      if (depth === 1 && /^\s*:/.test(raw.slice(index + 1)) && String(JSON.parse(raw.slice(start, index + 1))).toLowerCase() === 'id') count += 1
    }
  }
  return count === 1
}
export function exactId(raw: unknown): string | null {
  try {
    if (typeof raw === 'string' && !uniqueJsonIdKey(raw)) return null
    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!record(value)) return null
    const keys = aliasKeys(value, 'Id'); if (keys.length !== 1) return null
    const id = value[keys[0]]
    if (typeof id !== 'string' && !(typeof id === 'number' && Number.isSafeInteger(id))) return null
    const text = String(id)
    return /^[1-9]\d{0,18}$/.test(text) && BigInt(text) <= 9223372036854775807n ? text : null
  } catch { return null }
}
