import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { decodeReportWorkspaceDraft, encodeReportWorkspaceDraft, encodeReportWorkspaceSnapshot, reportWorkspaceDraftKey,
  type ReportWorkspaceDraft, type ReportWorkspaceSnapshot, type WorkspaceDraftFailure } from '../data/reportWorkspaceDraft'

export type WorkspaceDraftStatus = 'idle' | 'saved' | 'unavailable' | 'invalid' | 'too-large'
type Recovery = 'loading' | 'none' | 'pending' | 'blocked'
type State = {
  scope: object; ownerId: string | null; enabled: boolean; recovery: Recovery
  expectedRaw: string | null; initialKey: string | null; observedKey: string | null; hasDraft: boolean
  envelope: ReportWorkspaceDraft | null; previousSnapshot: ReportWorkspaceSnapshot | null
  status: WorkspaceDraftStatus; savedAt: string | null; message: string | null
}
type Options = { ownerId: string | null; enabled: boolean; ready: boolean; snapshot: ReportWorkspaceSnapshot }
type Apply = (snapshot: ReportWorkspaceSnapshot) => boolean
export type ReportWorkspaceDraftRecovery = {
  recovery: Recovery; pendingSnapshot: ReportWorkspaceSnapshot | null; previousSnapshot: ReportWorkspaceSnapshot | null
  status: WorkspaceDraftStatus; savedAt: string | null; message: string | null
  restore: (apply: Apply) => boolean; undo: (apply: Apply) => boolean
  rememberBeforeReplace: () => boolean; discardRecovery: () => boolean
}
const unavailable = 'Сховище цієї вкладки недоступне або переповнене. Поточні налаштування залишаються в конструкторі.'

function initialState(ownerId: string | null, enabled: boolean): State {
  return { scope: {}, ownerId, enabled, recovery: ownerId && enabled ? 'loading' : 'none', expectedRaw: null,
    initialKey: null, observedKey: null, hasDraft: false, envelope: null, previousSnapshot: null,
    status: 'idle', savedAt: null, message: null }
}
function failureState(state: State, failure: WorkspaceDraftFailure): State {
  return { ...state, status: failure.reason === 'too-large' ? 'too-large' : 'invalid',
    message: failure.reason === 'too-large' ? 'Чернетка перевищує 1 МіБ. Попередня збережена копія залишилася без змін.'
      : 'Ці налаштування не вдалося безпечно зберегти як чернетку. Попередня копія залишилася без змін.' }
}
function readRaw(state: State, raw: string | null): State {
  if (raw === null) return { ...state, recovery: 'none', expectedRaw: null, envelope: null,
    previousSnapshot: null, savedAt: null, status: 'idle', message: null }
  const decoded = decodeReportWorkspaceDraft(raw, state.ownerId!)
  if (!decoded.ok) return { ...failureState(state, decoded), recovery: 'blocked', expectedRaw: raw, envelope: null,
    previousSnapshot: null, savedAt: null, message: 'Збережена чернетка має непідтримуваний або пошкоджений формат. Вона залишиться у вкладці, доки ви явно не видалите її.' }
  return { ...state, recovery: 'pending', expectedRaw: raw, envelope: decoded.data,
    previousSnapshot: decoded.data.previousSnapshot ?? null, savedAt: decoded.data.savedAt, status: 'idle', message: null }
}
function readStorage(state: State): State {
  try { return readRaw(state, sessionStorage.getItem(reportWorkspaceDraftKey(state.ownerId!))) }
  catch { return { ...state, recovery: 'none', status: 'unavailable', message: unavailable } }
}

/** Compare the exact previously read bytes before replacing any stored candidate. */
function persist(state: State, snapshot: ReportWorkspaceSnapshot, previousSnapshot: ReportWorkspaceSnapshot | null): State {
  const next = { ...state, previousSnapshot }
  const encoded = encodeReportWorkspaceDraft({ version: 1, ownerId: state.ownerId!, savedAt: new Date().toISOString(), snapshot,
    ...(previousSnapshot ? { previousSnapshot } : {}) })
  if (!encoded.ok) return failureState(next, encoded)
  try {
    const key = reportWorkspaceDraftKey(state.ownerId!)
    const current = sessionStorage.getItem(key)
    if (current !== state.expectedRaw) return readRaw(next, current)
    sessionStorage.setItem(key, encoded.value)
    return { ...next, recovery: 'none', expectedRaw: encoded.value, envelope: encoded.data,
      status: 'saved', savedAt: encoded.data.savedAt, message: null }
  } catch { return { ...next, status: 'unavailable', message: unavailable } }
}

function synchronize(state: State, ready: boolean, snapshot: ReturnType<typeof encodeReportWorkspaceSnapshot>): State {
  if (state.recovery === 'loading') return readStorage(state)
  if (state.recovery !== 'none' || !ready) return state
  if (!snapshot.ok) {
    const next = failureState(state, snapshot)
    return next.status === state.status && next.message === state.message ? state : next
  }
  if (state.initialKey === null) return { ...state, initialKey: snapshot.value, observedKey: snapshot.value }
  if (state.observedKey === snapshot.value) return state
  return persist({ ...state, observedKey: snapshot.value, hasDraft: true }, snapshot.data, state.previousSnapshot)
}

/** This scoped adapter publishes acknowledgements from the tab's external storage. */
function createStorageScope(ownerId: string | null, enabled: boolean) {
  let current = initialState(ownerId, enabled)
  const listeners = new Set<() => void>()
  const get = () => current
  const set = (next: State) => {
    if (next === current) return
    current = next
    listeners.forEach(listener => listener())
  }
  return { get, set, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    synchronize: (ready: boolean, snapshot: ReturnType<typeof encodeReportWorkspaceSnapshot>) => set(synchronize(current, ready, snapshot)) }
}

/** Tab-local recovery only. No report generation, saved-template mutation or result persistence. */
export function useReportWorkspaceDraft({ ownerId, enabled, ready, snapshot }: Options): ReportWorkspaceDraftRecovery {
  const store = useMemo(() => createStorageScope(ownerId, enabled), [ownerId, enabled])
  const state = useSyncExternalStore(store.subscribe, store.get, store.get)
  const setStored = store.set
  const scope = state.scope
  const liveScope = useRef<object | null>(null)
  const liveReady = useRef(false)
  const encoded = useMemo(() => encodeReportWorkspaceSnapshot(snapshot), [snapshot])
  useEffect(() => {
    liveScope.current = scope
    liveReady.current = ready
    return () => { liveScope.current = null; liveReady.current = false }
  }, [scope, ready])
  useEffect(() => {
    if (!ownerId || !enabled) return
    store.synchronize(ready, encoded)
  }, [ownerId, enabled, ready, encoded, state, store])

  const permitted = () => Boolean(ownerId && enabled && liveScope.current === scope)
  const applicable = () => permitted() && ready && liveReady.current

  function restore(apply: Apply): boolean {
    if (!applicable() || state.recovery !== 'pending' || !state.envelope) return false
    try {
      const raw = sessionStorage.getItem(reportWorkspaceDraftKey(ownerId!))
      if (raw !== state.expectedRaw) { setStored(readRaw(state, raw)); return false }
    } catch { setStored({ ...state, status: 'unavailable', message: unavailable }); return false }
    const candidate = state.envelope.snapshot
    if (!apply(structuredClone(candidate)) || !applicable()) return false
    const key = encodeReportWorkspaceSnapshot(candidate)
    if (!key.ok) return false // The decoded candidate already passed this same bounded shape.
    setStored({ ...state, recovery: 'none', initialKey: key.value, observedKey: key.value, hasDraft: true, message: null })
    return true
  }

  function rememberBeforeReplace(): boolean {
    if (!applicable() || state.recovery !== 'none' || !encoded.ok) return false
    if (!state.hasDraft && (state.initialKey === null || state.initialKey === encoded.value) && !encoded.data.activeTemplate) return false
    const previous = structuredClone(encoded.data)
    setStored(persist({ ...state, observedKey: encoded.value, hasDraft: true }, encoded.data, previous))
    return true
  }

  function undo(apply: Apply): boolean {
    if (!applicable() || state.recovery !== 'none' || !state.previousSnapshot) return false
    const candidate = state.previousSnapshot
    if (!apply(structuredClone(candidate)) || !applicable()) return false
    const key = encodeReportWorkspaceSnapshot(candidate)
    if (!key.ok) return false
    setStored(persist({ ...state, observedKey: key.value, hasDraft: true }, candidate, null))
    return true
  }

  function discardRecovery(): boolean {
    if (!permitted()) return false
    try { sessionStorage.removeItem(reportWorkspaceDraftKey(ownerId!)) }
    catch { setStored({ ...state, status: 'unavailable', message: unavailable }); return false }
    setStored({ ...initialState(ownerId, enabled), scope, recovery: 'none',
      initialKey: ready && encoded.ok ? encoded.value : null, observedKey: ready && encoded.ok ? encoded.value : null })
    return true
  }

  const visible = Boolean(ownerId && enabled)
  return { recovery: visible ? (state.recovery === 'none' && !ready ? 'loading' : state.recovery) : 'none',
    pendingSnapshot: visible && state.recovery === 'pending' ? structuredClone(state.envelope!.snapshot) : null,
    previousSnapshot: visible && state.previousSnapshot ? structuredClone(state.previousSnapshot) : null,
    status: visible ? state.status : 'idle', savedAt: visible ? state.savedAt : null, message: visible ? state.message : null,
    restore, undo, rememberBeforeReplace, discardRecovery }
}
