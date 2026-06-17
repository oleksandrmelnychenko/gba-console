export function createConsoleTableMarker(value?: string | number | null): string {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue || normalizedValue === '—') {
    return '#'
  }

  const words = normalizedValue.split(/\s+/).filter(Boolean)
  const marker = words.length > 1 ? `${words[0][0]}${words[1][0]}` : normalizedValue.slice(0, 2)

  return marker.toLocaleUpperCase('uk')
}
