import { useSyncExternalStore } from 'react'
import { apiRequest } from '../api/apiClient'

export type SystemOfRecordCutoverState = {
  cutoverUtc: string | null
  isActive: boolean
  loaded: boolean
}

const initialState: SystemOfRecordCutoverState = {
  cutoverUtc: null,
  isActive: false,
  loaded: false,
}

let state = initialState
let request: Promise<void> | null = null
const listeners = new Set<() => void>()

export function normalizeSystemOfRecordCutover(payload: unknown): SystemOfRecordCutoverState {
  const value = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const isActive = value.IsActive === true

  return {
    cutoverUtc: isActive && typeof value.CutoverUtc === 'string' ? value.CutoverUtc : null,
    isActive,
    loaded: true,
  }
}

export function loadSystemOfRecordCutover(): Promise<void> {
  if (!request) {
    request = apiRequest<unknown>('/data/sync/cutover')
      .then((payload) => {
        setState(normalizeSystemOfRecordCutover(payload))
      })
      .catch(() => {
        request = null
      })
  }

  return request
}

export function useSystemOfRecordCutover(): SystemOfRecordCutoverState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function isSystemOfRecordCutoverActive(): boolean {
  return state.isActive
}

export function resetSystemOfRecordCutoverForTests(next: SystemOfRecordCutoverState = initialState): void {
  request = next.loaded ? Promise.resolve() : null
  setState(next)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!state.loaded) {
    void loadSystemOfRecordCutover()
  }

  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): SystemOfRecordCutoverState {
  return state
}

function setState(next: SystemOfRecordCutoverState): void {
  if (
    next.isActive === state.isActive
    && next.cutoverUtc === state.cutoverUtc
    && next.loaded === state.loaded
  ) {
    return
  }

  state = next
  listeners.forEach((listener) => listener())
}
