export function plainCaption(caption: string): string {
  return caption.replace(/\s+\[\d+\]$/, '').trim()
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
