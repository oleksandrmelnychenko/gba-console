import { formatLocalDate, SYNC_DATA_RANGE_START } from '../../shared/date/dateTime'
import { allDailySyncTypes } from './syncOptions'
import type { DataSyncStatus } from './types'

export type SyncMode = 'daily' | 'full'
export type SyncSource = 'amg' | 'fenix'

export type SyncDateRange = {
  from: string
  to: string
}

export type SyncDateRangeErrors = {
  from?: string
  range?: string
  to?: string
}

export type SyncState = {
  dateRanges: Record<SyncMode, SyncDateRange>
  isStarting: boolean
  isStatusRefreshing: boolean
  mode: SyncMode
  opened: boolean
  pendingRun: SyncMode | null
  selectedDailyDocumentTypes: string[]
  source: SyncSource
  status: DataSyncStatus | null
  statusError: string
}

export type SyncAction =
  | { type: 'opened' }
  | { type: 'closed' }
  | { type: 'modeChanged'; mode: SyncMode }
  | { type: 'sourceChanged'; source: SyncSource }
  | { type: 'statusRefreshStarted' }
  | { type: 'statusSucceeded'; status: DataSyncStatus }
  | { type: 'statusFailed'; message: string }
  | { type: 'syncStarted' }
  | { type: 'syncFinished' }
  | { type: 'confirmationRequested'; mode: SyncMode }
  | { type: 'confirmationCanceled' }
  | { type: 'dailyDocumentTypesChanged'; types: string[] }
  | {
      type: 'dateChanged'
      boundary: keyof SyncDateRange
      mode: SyncMode
      value: string
    }

const STRICT_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
export const MIN_SYNC_SESSION_DATE = SYNC_DATA_RANGE_START

export function createInitialSyncState(today = getTodaySyncDate()): SyncState {
  return {
    dateRanges: {
      full: {
        from: MIN_SYNC_SESSION_DATE,
        to: today,
      },
      daily: {
        from: today,
        to: today,
      },
    },
    isStarting: false,
    isStatusRefreshing: false,
    mode: 'full',
    opened: false,
    pendingRun: null,
    selectedDailyDocumentTypes: [...allDailySyncTypes],
    source: 'amg',
    status: null,
    statusError: '',
  }
}

export function syncReducer(state: SyncState, action: SyncAction): SyncState {
  switch (action.type) {
    case 'opened':
      return { ...state, opened: true }
    case 'closed':
      return { ...state, opened: false, pendingRun: null }
    case 'modeChanged':
      return { ...state, mode: action.mode, pendingRun: null }
    case 'sourceChanged':
      return { ...state, source: action.source, pendingRun: null }
    case 'statusRefreshStarted':
      return { ...state, isStatusRefreshing: true }
    case 'statusSucceeded':
      return {
        ...state,
        isStatusRefreshing: false,
        status: action.status,
        statusError: '',
      }
    case 'statusFailed':
      return {
        ...state,
        isStatusRefreshing: false,
        statusError: action.message,
      }
    case 'syncStarted':
      return { ...state, isStarting: true, pendingRun: null }
    case 'syncFinished':
      return { ...state, isStarting: false }
    case 'confirmationRequested':
      return { ...state, pendingRun: action.mode }
    case 'confirmationCanceled':
      return { ...state, pendingRun: null }
    case 'dailyDocumentTypesChanged':
      return {
        ...state,
        pendingRun: null,
        selectedDailyDocumentTypes: getKnownDocumentTypes(action.types),
      }
    case 'dateChanged':
      return {
        ...state,
        dateRanges: {
          ...state.dateRanges,
          [action.mode]: {
            ...state.dateRanges[action.mode],
            [action.boundary]: action.value,
          },
        },
        pendingRun: null,
      }
    default:
      return state
  }
}

export function getTodaySyncDate(now = new Date()): string {
  return formatLocalDate(now)
}

export function validateSyncDateRange(
  range: SyncDateRange,
  today = getTodaySyncDate(),
): SyncDateRangeErrors {
  const errors: SyncDateRangeErrors = {}

  errors.from = validateDateBoundary(range.from, 'Дата від є обов’язковою')
  errors.to = validateDateBoundary(range.to, 'Дата до є обов’язковою')

  if (!errors.from && range.from < MIN_SYNC_SESSION_DATE) {
    errors.from = 'Дата не може бути раніше 01.01.2025'
  }

  if (!errors.to && range.to < MIN_SYNC_SESSION_DATE) {
    errors.to = 'Дата не може бути раніше 01.01.2025'
  }

  if (!errors.to && range.to > today) {
    errors.to = 'Дата завершення не може бути пізніше сьогодні'
  }

  if (!errors.from && !errors.to && range.from > range.to) {
    errors.range = 'Дата початку має бути не пізніше дати завершення'
  }

  return removeEmptyErrors(errors)
}

export function getFirstSyncDateRangeError(errors: SyncDateRangeErrors): string {
  return errors.from || errors.to || errors.range || ''
}

export function hasSyncDateRangeErrors(errors: SyncDateRangeErrors): boolean {
  return Boolean(getFirstSyncDateRangeError(errors))
}

export function getSessionDocumentTypes(
  mode: SyncMode,
  selectedDailyTypes: string[],
): string[] {
  return mode === 'full'
    ? [...allDailySyncTypes]
    : getKnownDocumentTypes(selectedDailyTypes)
}

export function isStrictSyncDate(value: string): boolean {
  if (!STRICT_DATE_ONLY_PATTERN.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function validateDateBoundary(value: string, requiredMessage: string): string | undefined {
  if (!value) {
    return requiredMessage
  }

  return isStrictSyncDate(value) ? undefined : 'Вкажіть дату у форматі РРРР-ММ-ДД'
}

function getKnownDocumentTypes(types: string[]): string[] {
  const selectedTypes = new Set(types)
  return allDailySyncTypes.filter((type) => selectedTypes.has(type))
}

function removeEmptyErrors(errors: SyncDateRangeErrors): SyncDateRangeErrors {
  return Object.fromEntries(
    Object.entries(errors).filter((entry): entry is [string, string] => Boolean(entry[1])),
  )
}
