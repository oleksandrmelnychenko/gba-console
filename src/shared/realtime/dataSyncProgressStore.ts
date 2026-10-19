import { useSyncExternalStore } from 'react'
import type { DataSyncNotification } from './events'

export type DataSyncProgressState = {
  finishedAt?: number
  isActive: boolean
  isError: boolean
  message: string
  messages: string[]
  revision: number
  runId?: string
  updatedAt?: number
}

export type DataSyncNotificationKind = 'progress' | 'step-error' | 'terminal-error' | 'terminal-success'

export type DataSyncStatusObservation = {
  revision?: number
  runId?: string | null
}

const MAX_MESSAGES = 50

const initialState: DataSyncProgressState = {
  isActive: false,
  isError: false,
  message: '',
  messages: [],
  revision: 0,
}

let state = initialState
const listeners = new Set<() => void>()

export function useDataSyncProgress(): DataSyncProgressState {
  return useSyncExternalStore(subscribe, getDataSyncProgressSnapshot, getDataSyncProgressSnapshot)
}

export function useIsDataSyncActive(): boolean {
  return useSyncExternalStore(subscribe, getIsDataSyncActive, getIsDataSyncActive)
}

export function normalizeDataSyncRunId(runId: unknown): string | undefined {
  if (typeof runId !== 'string') {
    return undefined
  }

  const normalized = runId.replaceAll('-', '').trim().toLowerCase()

  return normalized && !/^0+$/.test(normalized) ? normalized : undefined
}

export function classifyDataSyncNotification(notification: DataSyncNotification): DataSyncNotificationKind {
  if (typeof notification.IsTerminal === 'boolean') {
    if (notification.IsTerminal) {
      return notification.IsError ? 'terminal-error' : 'terminal-success'
    }

    return notification.IsError ? 'step-error' : 'progress'
  }

  if (notification.IsError) {
    return 'terminal-error'
  }

  return notification.StopProgressBar ? 'terminal-success' : 'progress'
}

export function markDataSyncStarted(message: string, runId?: string | null): void {
  const nextMessage = message.trim()
  const nextRunId = normalizeDataSyncRunId(runId)

  if (nextRunId && nextRunId === state.runId && !state.isActive && state.finishedAt !== undefined) {
    return
  }

  updateState({
    finishedAt: undefined,
    isActive: true,
    isError: false,
    message: nextMessage || state.message,
    messages: appendMessage(state.messages, nextMessage),
    revision: state.revision + 1,
    runId: nextRunId ?? (state.isActive ? state.runId : undefined),
    updatedAt: Date.now(),
  })
}

export function applyDataSyncNotification(notification: DataSyncNotification): void {
  const kind = classifyDataSyncNotification(notification)
  const isFinished = kind === 'terminal-error' || kind === 'terminal-success'
  const notificationRunId = normalizeDataSyncRunId(notification.PipelineRunId)

  if (isFinished && isTerminalOfAnotherRun(notificationRunId)) {
    return
  }

  const nextMessage = notification.DisplayMessage?.trim() || ''

  updateState({
    finishedAt: isFinished ? Date.now() : undefined,
    isActive: !isFinished,
    isError: kind === 'terminal-error',
    message: nextMessage || state.message,
    messages: appendMessage(state.messages, nextMessage),
    revision: state.revision + 1,
    runId: notificationRunId ?? (state.isActive ? state.runId : undefined),
    updatedAt: Date.now(),
  })
}

export function clearDataSyncProgress(): void {
  updateState(initialState)
}

export function getDataSyncProgressRevision(): number {
  return state.revision
}

export function reconcileDataSyncProgress(
  isInProgress: boolean,
  observation: DataSyncStatusObservation = {},
): void {
  if (observation.revision !== undefined && observation.revision !== state.revision) {
    return
  }

  const observedRunId = normalizeDataSyncRunId(observation.runId)

  if (isInProgress) {
    const isSameRun = Boolean(observedRunId && observedRunId === state.runId)

    if (state.isActive && !state.isError && (!observedRunId || isSameRun || !state.runId)) {
      if (observedRunId && !state.runId) {
        updateState({ ...state, runId: observedRunId })
      }

      return
    }

    updateState({
      ...state,
      finishedAt: undefined,
      isActive: true,
      isError: false,
      message: isSameRun ? state.message : '',
      runId: observedRunId,
      updatedAt: Date.now(),
    })
    return
  }

  if (!state.isActive && !state.isError) {
    return
  }

  updateState({
    ...state,
    finishedAt: Date.now(),
    isActive: false,
    isError: false,
    updatedAt: Date.now(),
  })
}

export function getDataSyncProgressSnapshot(): DataSyncProgressState {
  return state
}

function getIsDataSyncActive(): boolean {
  return state.isActive
}

function isTerminalOfAnotherRun(notificationRunId: string | undefined): boolean {
  return Boolean(state.isActive && notificationRunId && state.runId && notificationRunId !== state.runId)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

function updateState(nextState: DataSyncProgressState): void {
  state = nextState
  listeners.forEach((listener) => listener())
}

function appendMessage(messages: string[], message: string): string[] {
  if (!message) {
    return messages
  }

  return [message, ...messages].slice(0, MAX_MESSAGES)
}
