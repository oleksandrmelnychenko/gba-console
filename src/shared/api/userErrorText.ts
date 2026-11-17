import { translate } from '../i18n/translate'
import { ApiError } from './apiClient'

const CYRILLIC = /[а-щьюяґєії]/gi
const LATIN = /[a-z]/gi
const TECHNICAL_PREFIX = /^[A-Za-z][A-Za-z0-9_.]*(Api|Error|Exception)\b\s*:/

export function technicalErrorText(error: unknown): string {
  if (error instanceof Error) return error.message.trim()
  return typeof error === 'string' ? error.trim() : ''
}

export function isUserReadableText(text: string): boolean {
  if (!text || TECHNICAL_PREFIX.test(text)) return false
  const cyrillic = text.match(CYRILLIC)?.length ?? 0
  const latin = text.match(LATIN)?.length ?? 0
  return cyrillic > 0 && cyrillic >= latin * 2
}

/**
 * A backend AI service that is not configured on this server (e.g. "ai_service_not_configured") is a
 * permanent condition: retrying cannot help, and the user should not see it as a transient outage.
 */
export function isServiceNotConfigured(error: unknown): boolean {
  const status = error instanceof ApiError ? error.status : null
  return (status === 503 || status === 501) && /not[_ ]configured/i.test(technicalErrorText(error))
}

function failureHint(error: unknown): string {
  if (isServiceNotConfigured(error)) return translate('Сервіс не налаштовано на цьому сервері. Зверніться до адміністратора.')
  const status = error instanceof ApiError ? error.status : null
  if (status === 401) return translate('Сесію завершено. Увійдіть повторно.')
  if (status === 403) return translate('Недостатньо прав для цієї дії.')
  if (status === 404) return translate('Дані не знайдено.')
  if (status === 0 || status === 502 || status === 503 || status === 504) return translate('Сервіс тимчасово недоступний. Спробуйте пізніше.')
  return translate('Спробуйте пізніше.')
}

export function userErrorText(error: unknown, fallback: string): string {
  const technical = technicalErrorText(error)
  if (isUserReadableText(technical)) return technical
  if (technical) console.warn('[gba] technical error hidden from the user:', technical)
  const base = fallback.trim().replace(/[.…!]+$/, '')
  return `${base}. ${failureHint(error)}`
}
