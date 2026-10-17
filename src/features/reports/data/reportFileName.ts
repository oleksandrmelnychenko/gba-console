const FORBIDDEN = /[\\/:*?"<>|]+/g

function displayDay(value: string): string {
  return /^\d{4}-\d\d-\d\d$/.test(value) ? value.split('-').reverse().join('.') : value
}

export function reportFileBaseName(name: string, from: string, to: string, periodSupported: boolean): string {
  const clean = name.replace(/\.xlsx?$/i, '').replace(FORBIDDEN, ' ').replace(/\s+/g, ' ').trim() || 'Звіт'
  if (!periodSupported || !from || !to) return clean
  return from === to ? `${clean} ${displayDay(from)}` : `${clean} ${displayDay(from)}-${displayDay(to)}`
}
