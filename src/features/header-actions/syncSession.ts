import type { DataSyncAcceptedScope, DataSyncPipelineRun, DataSyncStatus } from './types'

export type SyncSessionTone = 'error' | 'idle' | 'running' | 'success'

export function getVisibleSyncRun(status?: DataSyncStatus | null): DataSyncPipelineRun | null {
  if (isSyncStatusRunning(status)) {
    return status?.ActiveRun ?? null
  }

  return status?.LastTerminalRun ?? null
}

export function getSyncOperationLabel(operationType?: string): string {
  switch (operationType) {
    case 'DataSync':
      return 'Повна синхронізація'
    case 'Daily':
      return 'Щоденна синхронізація'
    case 'IncomedOrders':
      return 'Синхронізація приходів'
    case 'OutcomeOrders':
      return 'Синхронізація видаткових документів'
    default:
      return 'Синхронізація'
  }
}

export function getSyncSourceLabel(forAmg?: boolean): string {
  return forAmg ? 'AMG' : 'FENIX'
}

export function getSyncScopeSummary(scope?: DataSyncAcceptedScope | null): string {
  if (!scope) {
    return ''
  }

  if (scope.OperationType === 'DataSync') {
    return formatCount(scope.SyncEntityTypes.length, 'розділ', 'розділи', 'розділів')
  }

  if (scope.OperationType === 'Daily') {
    const range = formatScopeRange(scope.From, scope.To)
    const documentTypes = formatCount(scope.Types.length, 'тип документа', 'типи документів', 'типів документів')
    const mode = scope.StockMode === 'DocumentsOnly' ? 'без зміни залишків' : ''

    return [range, documentTypes, mode].filter(Boolean).join(' · ')
  }

  return formatScopeRange(scope.From, scope.To)
}

export function getSyncSessionTone(status?: DataSyncStatus | null): SyncSessionTone {
  if (isSyncStatusRunning(status)) {
    return 'running'
  }

  if (status?.LastTerminalRun?.Status === 'Failed') {
    return 'error'
  }

  if (status?.LastTerminalRun?.Status === 'Finished') {
    return 'success'
  }

  return 'idle'
}

export function isSyncStatusRunning(status?: DataSyncStatus | null): boolean {
  return Boolean(
    status?.IsInProgress ||
      status?.IsGlobalLockHeld ||
      status?.ActiveRun?.Status === 'Running',
  )
}

export function getSyncSessionStatusLabel(tone: SyncSessionTone): string {
  switch (tone) {
    case 'running':
      return 'Виконується'
    case 'error':
      return 'Помилка'
    case 'success':
      return 'Завершено'
    default:
      return 'Очікує запуску'
  }
}

export function cleanStartedBy(value?: string): string {
  return value?.replace(/^<|>$/g, '').trim() || '—'
}

function formatScopeRange(from?: string | null, to?: string | null): string {
  const formattedFrom = formatScopeDate(from)
  const formattedTo = formatScopeDate(to)

  if (formattedFrom && formattedTo) {
    return formattedFrom === formattedTo ? formattedFrom : `${formattedFrom} – ${formattedTo}`
  }

  return formattedFrom || formattedTo
}

function formatScopeDate(value?: string | null): string {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : ''
}

function formatCount(count: number, one: string, few: string, many: string): string {
  const remainder100 = count % 100
  const remainder10 = count % 10
  const word =
    remainder100 >= 11 && remainder100 <= 14
      ? many
      : remainder10 === 1
        ? one
        : remainder10 >= 2 && remainder10 <= 4
          ? few
          : many

  return `${count} ${word}`
}
