import type {
  DataSyncAcceptedScope,
  DataSyncPipelineRun,
  DataSyncSessionProgress,
  DataSyncSessionStageProgress,
  DataSyncStatus,
} from './types'

export type SyncSessionTone = 'error' | 'idle' | 'running' | 'success'
export type CompositeSyncStageTone = 'error' | 'pending' | 'running' | 'success'

export type CompositeSyncStageView = {
  attemptCount: number
  failedStep: string
  isCurrent: boolean
  label: string
  ordinal: number
  range: string
  statusLabel: string
  tone: CompositeSyncStageTone
}

export type CompositeSyncProgressView = {
  completedStages: number
  currentStage: CompositeSyncStageView | null
  currentStageNumber: number | null
  progressPercent: number
  stages: CompositeSyncStageView[]
  totalStages: number
}

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
    case 'FullSession':
      return 'Повна синхронізація'
    case 'Daily':
      return 'Щоденна синхронізація'
    case 'DailySession':
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

  if (scope.OperationType === 'FullSession' || scope.OperationType === 'DailySession') {
    const range = formatScopeRange(scope.From, scope.To)
    const documentTypes = formatCount(scope.Types.length, 'тип документа', 'типи документів', 'типів документів')

    return [range, documentTypes].filter(Boolean).join(' · ')
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

  if (status?.Session?.Stages.some((stage) => stage.Status === 'Failed')) {
    return 'error'
  }

  if (status?.LastTerminalRun?.Status === 'Finished') {
    return 'success'
  }

  if (
    status?.Session &&
    status.Session.Stages.length > 0 &&
    status.Session.Stages.every((stage) => stage.Status === 'Finished')
  ) {
    return 'success'
  }

  return 'idle'
}

export function isSyncStatusRunning(status?: DataSyncStatus | null): boolean {
  return Boolean(
    status?.IsInProgress ||
      status?.IsGlobalLockHeld ||
      status?.ActiveRun?.Status === 'Running' ||
      status?.Session?.Stages.some((stage) => stage.Status === 'Running'),
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

export function getCompositeSyncProgress(
  session?: DataSyncSessionProgress | null,
): CompositeSyncProgressView | null {
  if (!session) {
    return null
  }

  const sortedStages = session.Stages.toSorted((left, right) => left.Ordinal - right.Ordinal)
  const runningStage = sortedStages.find((stage) => stage.Status === 'Running')
  const currentOrdinal =
    typeof session.CurrentStageOrdinal === 'number'
      ? session.CurrentStageOrdinal
      : runningStage?.Ordinal ?? null
  const stages = sortedStages.map((stage) => mapCompositeSyncStage(stage, currentOrdinal))
  const currentStage = stages.find((stage) => stage.isCurrent) ?? null
  const currentStageIndex = currentStage
    ? stages.findIndex((stage) => stage.ordinal === currentStage.ordinal)
    : -1
  const totalStages = Math.max(session.TotalStages, stages.length)
  const completedStages = stages.filter((stage) => stage.tone === 'success').length
  const currentStageNumber =
    currentStageIndex >= 0
      ? currentStageIndex + 1
      : currentOrdinal === null
        ? null
        : Math.min(currentOrdinal + 1, totalStages)

  return {
    completedStages,
    currentStage,
    currentStageNumber,
    progressPercent: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0,
    stages,
    totalStages,
  }
}

export function getSyncSessionModeLabel(mode?: string): string {
  switch (mode) {
    case 'Full':
    case 'FullSession':
      return 'Повна синхронізація'
    case 'Daily':
    case 'DailySession':
      return 'Щоденна синхронізація'
    default:
      return 'Сесія синхронізації'
  }
}

function mapCompositeSyncStage(
  stage: DataSyncSessionStageProgress,
  currentOrdinal: number | null,
): CompositeSyncStageView {
  return {
    attemptCount: stage.AttemptCount,
    failedStep: stage.FailedStep || '',
    isCurrent: stage.Ordinal === currentOrdinal,
    label: getCompositeSyncStageLabel(stage.Kind, stage.Ordinal),
    ordinal: stage.Ordinal,
    range: formatScopeRange(stage.From, stage.To),
    statusLabel: getCompositeSyncStageStatusLabel(stage.Status),
    tone: getCompositeSyncStageTone(stage.Status),
  }
}

function getCompositeSyncStageLabel(kind: string, ordinal: number): string {
  switch (kind) {
    case 'MasterData':
      return 'Довідники та основні дані'
    case 'Documents':
      return 'Документи'
    case 'CurrentState':
      return 'Поточний стан: залишки й баланси'
    default:
      return `Етап ${ordinal + 1}`
  }
}

function getCompositeSyncStageStatusLabel(status: string): string {
  switch (status) {
    case 'Running':
      return 'Виконується'
    case 'Finished':
      return 'Завершено'
    case 'Failed':
      return 'Помилка'
    default:
      return 'Очікує'
  }
}

function getCompositeSyncStageTone(status: string): CompositeSyncStageTone {
  switch (status) {
    case 'Running':
      return 'running'
    case 'Finished':
      return 'success'
    case 'Failed':
      return 'error'
    default:
      return 'pending'
  }
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
