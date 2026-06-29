import { useSyncExternalStore } from 'react'
import type { DataSyncNotification } from './events'

export type DataSyncProgressState = {
  finishedAt?: number
  isActive: boolean
  isError: boolean
  message: string
  messages: string[]
  updatedAt?: number
}

const MAX_MESSAGES = 50

const initialState: DataSyncProgressState = {
  isActive: false,
  isError: false,
  message: '',
  messages: [],
}

let state = initialState
const listeners = new Set<() => void>()

export function useDataSyncProgress(): DataSyncProgressState {
  return useSyncExternalStore(subscribe, getDataSyncProgressSnapshot, getDataSyncProgressSnapshot)
}

export function markDataSyncStarted(message: string): void {
  const nextMessage = message.trim()

  updateState({
    finishedAt: undefined,
    isActive: true,
    isError: false,
    message: nextMessage || state.message,
    messages: appendMessage(state.messages, nextMessage),
    updatedAt: Date.now(),
  })
}

export function applyDataSyncNotification(notification: DataSyncNotification): void {
  const nextMessage = notification.DisplayMessage?.trim() || ''
  const isFinished = Boolean(notification.StopProgressBar || notification.IsError)

  updateState({
    finishedAt: isFinished ? Date.now() : undefined,
    isActive: !isFinished,
    isError: Boolean(notification.IsError),
    message: nextMessage || state.message,
    messages: appendMessage(state.messages, nextMessage),
    updatedAt: Date.now(),
  })
}

export function clearDataSyncProgress(): void {
  updateState(initialState)
}

export function reconcileDataSyncProgress(isInProgress: boolean): void {
  if (isInProgress || !state.isActive) {
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
