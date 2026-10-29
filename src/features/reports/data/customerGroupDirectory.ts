import { revenueExactId } from './revenueComparison'

/** Presentation identity only: the stored Data object/string is never rewritten on load. */
export function customerGroupDirectoryId(raw: unknown): number | null {
  if (typeof raw === 'string' && (raw.length > 65536 || !canonicalJsonIdNumber(raw))) return null
  const text = revenueExactId(raw)
  if (!text) return null
  const id = Number(text)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
/** Inspect the Id numeric token before JSON.parse could round a fractional value into an integer. */
function canonicalJsonIdNumber(raw: string): boolean {
  let depth = 0
  try {
    for (let at = 0; at < raw.length; at++) {
      if (raw[at] === '{' || raw[at] === '[') depth++
      else if (raw[at] === '}' || raw[at] === ']') depth--
      else if (raw[at] === '"') {
        const start = at
        for (at++; at < raw.length; at++) {
          if (raw[at] === '\\') at++
          else if (raw[at] === '"') break
        }
        const tail = raw.slice(at + 1)
        if (depth !== 1 || !/^\s*:/.test(tail) || String(JSON.parse(raw.slice(start, at + 1))).toLowerCase() !== 'id') continue
        const token = tail.replace(/^\s*:\s*/, '')
        return token.startsWith('"') || /^[1-9][0-9]*(?=\s*[,}])/.test(token)
      }
    }
  } catch { return false }
  return false
}
