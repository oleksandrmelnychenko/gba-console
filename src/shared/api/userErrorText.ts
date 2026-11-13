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

function failureHint(error: unknown): string {
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
