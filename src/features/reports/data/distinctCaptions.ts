const STORED_ID = /\s*\[(?:id=)?(\d+)\]\s*$/i
export function plainCaption(caption: string): string {
  return caption.replace(STORED_ID, '').replace(/\s+/g, ' ').trim()
}
function dataId(data: unknown): string | null {
  let item = data
  if (typeof item === 'string') {
    try {
      item = JSON.parse(item)
    } catch {
      return null
    }
  }
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null
  const raw = item as Record<string, unknown>
  const id = raw.Id ?? raw.id ?? raw.NetUid
  return typeof id === 'string' && id.trim() ? id.trim() : typeof id === 'number' && Number.isFinite(id) ? String(id) : null
}
export function savedValueCaptions(values: readonly { Name?: string | null; Data?: unknown }[]): string[] {
  return distinctCaptions(values.map((value) => {
    const name = String(value.Name ?? '')
    return { id: STORED_ID.exec(name)?.[1] ?? dataId(value.Data), caption: plainCaption(name) }
  }))
}
export function distinctCaptions(entries: { id: string | null; caption: string }[]): string[] {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    const key = entry.caption.toLocaleUpperCase('uk')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return entries.map((entry) =>
    entry.id && (counts.get(entry.caption.toLocaleUpperCase('uk')) ?? 0) > 1 ? `${entry.caption} [${entry.id}]` : entry.caption,
  )
}
export function distinctOptions<T extends { value: string; label: string }>(items: T[]): T[] {
  const labels = distinctCaptions(items.map((item) => ({ id: item.value.startsWith('invalid:') ? null : item.value, caption: plainCaption(item.label) })))
  return items.map((item, index) => ({ ...item, label: labels[index] }))
}
