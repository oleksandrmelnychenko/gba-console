import { KYIV_TIME_ZONE } from '../../shared/date/dateTime'
import type { TranslateFunction } from '../../shared/i18n/types'
import type { ClientRegionManualEdit } from './types'

const REGION_CODE_DIRECTORY_SOURCE = 2

const kyivDateTime = new Intl.DateTimeFormat('uk-UA', {
  timeZone: KYIV_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatClientRegionManualEditTime(value: string): string {
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`
  const date = new Date(normalized)

  return Number.isNaN(date.getTime()) ? value : kyivDateTime.format(date)
}

export function getClientRegionManualEditNote(
  edit: ClientRegionManualEdit,
  t: TranslateFunction,
): string {
  const fromDirectory = edit.Source === REGION_CODE_DIRECTORY_SOURCE || edit.Source === 'RegionCodeDirectory'
  const name = edit.EditedByName?.trim()
  const at = formatClientRegionManualEditTime(edit.EditedAtUtc)

  if (fromDirectory) {
    return name
      ? t('Код по регіону змінено в довіднику регіонів: {name}, {at}. Синхронізація з 1С його не змінює.', { name, at })
      : t('Код по регіону змінено в довіднику регіонів {at}. Синхронізація з 1С його не змінює.', { at })
  }

  return name
    ? t('Код по регіону змінено вручну: {name}, {at}. Синхронізація з 1С його не змінює.', { name, at })
    : t('Код по регіону змінено вручну {at}. Синхронізація з 1С його не змінює.', { at })
}
