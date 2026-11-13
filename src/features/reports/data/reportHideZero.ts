import type { ReportRequestBody } from '../types'

export function reportHideZeroError(data: ReportRequestBody): string | null {
  const rule = Object.hasOwn(data, 'hideZero') ? data.hideZero : data.HideZero
  return rule == null ? null : 'Сервер не підтвердив приховування нулів для цього набору. Збережене правило не змінено.'
}
