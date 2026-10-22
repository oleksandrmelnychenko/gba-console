const kyivParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
function wallTime(timestamp: number): string {
  const parts = Object.fromEntries(kyivParts.formatToParts(timestamp).map(({ type, value }) => [type, value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}
/** Local datetime controls carry wall time; never interpret them in the browser timezone. */
export function kyivContactDateToUtc(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Вкажіть коректну дату та час')
  const guess = Date.parse(`${value}:00Z`)
  if (!Number.isFinite(guess) || new Date(guess).toISOString().slice(0, 16) !== value) throw new Error('Вкажіть коректну дату та час')
  const matches: number[] = []
  // Covers both offsets at a DST transition without guessing the browser's timezone.
  for (let minutes = -14 * 60; minutes <= 14 * 60; minutes += 15) {
    const candidate = guess + minutes * 60_000
    if (wallTime(candidate) === value) matches.push(candidate)
  }
  if (matches.length !== 1) throw new Error('Цей час неоднозначний або не існує через переведення годинника. Оберіть інший час')
  return new Date(matches[0]).toISOString()
}
const display = new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', dateStyle: 'short', timeStyle: 'short' })
export function formatContactDate(value: string): string { return display.format(new Date(value)) }
