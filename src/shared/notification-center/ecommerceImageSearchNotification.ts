import type { EcommerceImageSearchRealtimeNotification } from '../realtime/events'
import type { ConsoleNotification } from './types'

export function createEcommerceImageSearchNotification(
  imageSearch: EcommerceImageSearchRealtimeNotification,
  now = new Date(),
): ConsoleNotification | null {
  const netUid = imageSearch.NetUid?.trim()
  if (!netUid) {
    return null
  }

  const fileName = imageSearch.OriginalFileName?.trim()
  const visitor = imageSearch.IsAuthenticated === true
    ? 'Авторизований покупець'
    : 'Анонімний відвідувач'
  const locale = imageSearch.Locale?.trim().toUpperCase()

  return {
    createdAt: normalizeCreatedAt(imageSearch.CreatedAtUtc, now),
    entityNetUid: netUid,
    id: `ecommerce-ai-image-search:${netUid.toLowerCase()}`,
    kind: 'ecommerce-ai-image-search',
    message: [fileName, visitor, locale].filter(Boolean).join(' · '),
    route: `/sales-online-shop?workspace=image-searches&imageSearch=${encodeURIComponent(netUid)}`,
    title: 'Нове фото на AI-розпізнавання',
  }
}

function normalizeCreatedAt(value: string | undefined, fallback: Date): string {
  if (!value) {
    return fallback.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString()
}
