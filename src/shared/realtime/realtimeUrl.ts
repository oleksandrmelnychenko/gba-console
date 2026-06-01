import { REALTIME_BASE_URL } from '../config/env'

export function realtimeUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return new URL(normalizedPath, getAbsoluteBaseUrl(REALTIME_BASE_URL)).toString()
}

function getAbsoluteBaseUrl(baseUrl: string): string {
  if (/^https?:\/\//i.test(baseUrl)) {
    return baseUrl
  }

  return new URL(baseUrl || '/', window.location.origin).toString()
}
