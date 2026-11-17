/**
 * Title and body for a realtime toast. The server often sends only a title, or the same text
 * twice; showing it as both title and body read "Оновлено замовлення Оновлено замовлення".
 */
export function toastTitleAndMessage(title: string, message: string): { message: string; title?: string } {
  const body = message.trim()

  return body && body !== title.trim() ? { message: body, title } : { message: title }
}

// Admin pages (users, roles, online-shop SEO, vehicle registry) have nothing to do with supply orders or
// payment tasks; their realtime toasts are noise there. The events still reach the realtime bus.
const SUPPLY_TOAST_QUIET_ROUTE_PREFIXES = ['/users', '/online-shop-seo', '/online-shop-cities', '/administration']

export function isSupplyToastQuietRoute(pathname: string): boolean {
  return SUPPLY_TOAST_QUIET_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

const ISO_DATE_PATTERN = /\b(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g

/**
 * Server dates in toast text ("2026-11-16T00:00:00") as dd.MM.yyyy, with HH:mm when the time is not midnight.
 * Read from the string parts, not through Date, so a calendar date never shifts with the browser time zone.
 */
export function formatIsoDatesInText(text: string): string {
  return text.replace(ISO_DATE_PATTERN, (_match, year: string, month: string, day: string, hours?: string, minutes?: string) => {
    const date = `${day}.${month}.${year}`

    return hours && minutes && `${hours}:${minutes}` !== '00:00' ? `${date} ${hours}:${minutes}` : date
  })
}
