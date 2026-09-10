import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeReportWorkspaceDraft, encodeReportWorkspaceDraft, reportWorkspaceDraftKey, type ReportWorkspaceSnapshot } from '../data/reportWorkspaceDraft'
import { useReportWorkspaceDraft } from './useReportWorkspaceDraft'

const ownerId = 'owner-42'
const key = reportWorkspaceDraftKey(ownerId)
function workspaceSnapshot(): ReportWorkspaceSnapshot {
  const data = { dataSource: 8, from: '', to: '2026-', valuationClientAgreementId: 456246,
    sorted: { Row: [], Col: [], Measurements: [] }, selections: [], threshold: { Version: 9, Percent: '', future: false } }
  return { name: '', data, measurements: [{ Name: 'Amount', IsChecked: false, SubList: [{ Name: 'Count', Type: 17, IsChecked: false }] }],
    activeTemplate: { Id: 'template-42', Revision: 7, Name: 'Договір', Data: structuredClone(data) }, previousPeriod: { from: '', to: '2026-' } }
}
function fresh(): ReportWorkspaceSnapshot { return { ...workspaceSnapshot(), activeTemplate: null } }
function stored(snapshot = workspaceSnapshot(), previousSnapshot?: ReportWorkspaceSnapshot) {
  const encoded = encodeReportWorkspaceDraft({ version: 1, ownerId, savedAt: '2026-09-10T10:00:00.000Z', snapshot, ...(previousSnapshot ? { previousSnapshot } : {}) })
  if (!encoded.ok) throw new Error('fixture invalid')
  sessionStorage.setItem(key, encoded.value)
  return encoded.value
}
const options = (snapshot: ReportWorkspaceSnapshot = fresh()) => ({ ownerId: ownerId as string | null, enabled: true, ready: true, snapshot })
function read() {
  const raw = sessionStorage.getItem(key)!
  const decoded = decodeReportWorkspaceDraft(raw, ownerId)
  if (!decoded.ok) throw new Error('stored draft invalid')
  return decoded.data
}

describe('per-tab workspace draft recovery', () => {
  beforeEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); sessionStorage.clear() })
  it('does not save fresh defaults or loading transitions and saves only an actual later edit', () => {
    const first = options(); const view = renderHook(useReportWorkspaceDraft, { initialProps: { ...first, ready: false } })
    expect(sessionStorage.getItem(key)).toBeNull()
    view.rerender({ ...first, snapshot: { ...fresh(), name: 'Initialized after dataset load' }, ready: true })
    expect(sessionStorage.getItem(key)).toBeNull()
    view.rerender({ ...first, snapshot: { ...fresh(), name: 'User edit' }, ready: true })
    expect(read().snapshot.name).toBe('User edit')
    expect(view.result.current.status).toBe('saved')
  })
  it('retains stored bytes while pending, including when props change, and never applies implicitly', () => {
    const raw = stored(); const view = renderHook(useReportWorkspaceDraft, { initialProps: options() })
    expect(view.result.current.recovery).toBe('pending')
    view.rerender(options({ ...fresh(), name: 'Fresh initialization' }))
    expect(sessionStorage.getItem(key)).toBe(raw)
    const apply = vi.fn(() => false)
    act(() => { expect(view.result.current.restore(apply)).toBe(false) })
    expect(view.result.current.recovery).toBe('pending')
    expect(sessionStorage.getItem(key)).toBe(raw)
  })
  it('restores a cloned candidate with exact contract and template revision, without rewriting it on acceptance', () => {
    const saved = workspaceSnapshot(); const raw = stored(saved)
    const view = renderHook(useReportWorkspaceDraft, { initialProps: options() })
    act(() => {
      expect(view.result.current.restore(candidate => { expect(candidate).toEqual(saved); view.rerender(options(candidate)); return true })).toBe(true)
    })
    expect(view.result.current.recovery).toBe('none')
    expect(sessionStorage.getItem(key)).toBe(raw)
    expect(view.result.current.savedAt).toBe('2026-09-10T10:00:00.000Z')
    expect(read().snapshot.activeTemplate).toMatchObject({ Id: 'template-42', Revision: 7 })
  })
  it('does not expose or write another owner and rejects callbacks captured before permission change or unmount', () => {
    const raw = stored(); const view = renderHook(useReportWorkspaceDraft, { initialProps: options() })
    const stale = view.result.current
    view.rerender({ ...options(), ownerId: 'other-owner' })
    expect(view.result.current.pendingSnapshot).toBeNull()
    act(() => { expect(stale.discardRecovery()).toBe(false); expect(stale.restore(() => true)).toBe(false) })
    view.rerender({ ...options(), enabled: false })
    expect(view.result.current.pendingSnapshot).toBeNull()
    expect(sessionStorage.getItem(key)).toBe(raw)
    view.rerender(options())
    const unmounted = view.result.current; view.unmount()
    expect(unmounted.discardRecovery()).toBe(false)
    expect(sessionStorage.getItem(key)).toBe(raw)
  })
  it('requires datasets for restore and writes, but permits explicit discard while datasets are loading', () => {
    stored(); const view = renderHook(useReportWorkspaceDraft, { initialProps: { ...options(), ready: false } })
    const apply = vi.fn(() => true)
    act(() => { expect(view.result.current.restore(apply)).toBe(false) })
    expect(apply).not.toHaveBeenCalled()
    act(() => { expect(view.result.current.discardRecovery()).toBe(true) })
    expect(sessionStorage.getItem(key)).toBeNull()
    view.rerender(options({ ...fresh(), name: 'Later default' }))
    expect(sessionStorage.getItem(key)).toBeNull()
  })
  it('rejects stale restore and undo callbacks after dataset readiness changes', () => {
    stored(workspaceSnapshot(), { ...workspaceSnapshot(), name: 'Before' })
    const view = renderHook(useReportWorkspaceDraft, { initialProps: options() })
    const staleRestore = view.result.current.restore
    view.rerender({ ...options(), ready: false })
    const apply = vi.fn(() => true)
    act(() => { expect(staleRestore(apply)).toBe(false) })
    expect(apply).not.toHaveBeenCalled()
    view.rerender(options())
    act(() => { view.result.current.restore(candidate => { view.rerender(options(candidate)); return true }) })
    const staleUndo = view.result.current.undo; const raw = sessionStorage.getItem(key)
    view.rerender({ ...options(workspaceSnapshot()), ready: false })
    act(() => { expect(staleUndo(apply)).toBe(false) })
    expect(apply).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(key)).toBe(raw)
  })
  it.each(['{"version":88}', '{broken', JSON.stringify({ version: 1, ownerId: 'other-owner' })])('protects unsupported or malformed stored bytes %s until explicit discard', raw => {
    sessionStorage.setItem(key, raw)
    const view = renderHook(useReportWorkspaceDraft, { initialProps: options() })
    expect(view.result.current.recovery).toBe('blocked')
    view.rerender(options({ ...fresh(), name: 'Cannot overwrite' }))
    expect(sessionStorage.getItem(key)).toBe(raw)
    act(() => { expect(view.result.current.discardRecovery()).toBe(true) })
    expect(sessionStorage.getItem(key)).toBeNull()
    view.rerender(options({ ...fresh(), name: 'New authorized edit' }))
    expect(read().snapshot.name).toBe('New authorized edit')
  })
  it('keeps one undo snapshot through later edits and consumes it after restoring the original revision and contract', () => {
    const view = renderHook(useReportWorkspaceDraft, { initialProps: options() })
    expect(view.result.current.rememberBeforeReplace()).toBe(false)
    const before = { ...workspaceSnapshot(), name: 'Before reset' }
    view.rerender(options(before))
    act(() => { expect(view.result.current.rememberBeforeReplace()).toBe(true) })
    view.rerender(options({ ...fresh(), name: 'Replacement' }))
    view.rerender(options({ ...fresh(), name: 'Later edit' }))
    expect(read().previousSnapshot).toEqual(before)
    act(() => { expect(view.result.current.undo(candidate => { view.rerender(options(candidate)); return true })).toBe(true) })
    expect(read().snapshot).toEqual(before)
    expect(read()).not.toHaveProperty('previousSnapshot')
    expect(view.result.current.previousSnapshot).toBeNull()
  })
  it('clones external callback values and leaves recovery/undo intact when application fails', () => {
    const before = { ...workspaceSnapshot(), name: 'Undo exact' }; stored(workspaceSnapshot(), before)
    const view = renderHook(useReportWorkspaceDraft, { initialProps: options() })
    act(() => { view.result.current.restore(candidate => { candidate.data.valuationClientAgreementId = 1; candidate.name = 'Mutated'; return false }) })
    expect(view.result.current.pendingSnapshot?.data.valuationClientAgreementId).toBe(456246)
    act(() => { view.result.current.restore(candidate => { view.rerender(options(candidate)); return true }) })
    act(() => { expect(view.result.current.undo(candidate => { candidate.name = 'Mutated'; return false })).toBe(false) })
    expect(view.result.current.previousSnapshot).toEqual(before)
  })
  it('handles denied storage without breaking editing or losing in-memory undo', () => {
    const get = vi.fn(() => { throw new DOMException('denied', 'SecurityError') })
    vi.stubGlobal('sessionStorage', { getItem: get })
    const view = renderHook(useReportWorkspaceDraft, { initialProps: options() })
    expect(view.result.current.status).toBe('unavailable')
    expect(get).toHaveBeenCalled()
    const before = { ...fresh(), name: 'Still editable' }; view.rerender(options(before))
    act(() => { expect(view.result.current.rememberBeforeReplace()).toBe(true) })
    expect(view.result.current.previousSnapshot).toEqual(before)
    view.rerender(options({ ...fresh(), name: 'Replacement' }))
    act(() => { expect(view.result.current.undo(candidate => { view.rerender(options(candidate)); return true })).toBe(true) })
    expect(view.result.current.status).toBe('unavailable')
    expect(view.result.current.previousSnapshot).toBeNull()
    vi.unstubAllGlobals()
  })
  it('retains last saved bytes on quota failure and accepts the next edit after storage becomes available', () => {
    const view = renderHook(useReportWorkspaceDraft, { initialProps: options() })
    view.rerender(options({ ...fresh(), name: 'Saved' })); const raw = sessionStorage.getItem(key)
    const originalStorage = sessionStorage
    const set = vi.fn(() => { throw new DOMException('full', 'QuotaExceededError') })
    vi.stubGlobal('sessionStorage', { getItem: originalStorage.getItem.bind(originalStorage), setItem: set })
    view.rerender(options({ ...fresh(), name: 'Unsaved edit' }))
    expect(view.result.current.status).toBe('unavailable')
    expect(set).toHaveBeenCalled()
    expect(sessionStorage.getItem(key)).toBe(raw)
    vi.unstubAllGlobals()
    view.rerender(options({ ...fresh(), name: 'Next edit' }))
    expect(read().snapshot.name).toBe('Next edit')
  })
  it('never overwrites bytes changed externally after reading the storage key', () => {
    const view = renderHook(useReportWorkspaceDraft, { initialProps: options() })
    const raw = '{"version":300}'; sessionStorage.setItem(key, raw)
    view.rerender(options({ ...fresh(), name: 'Cannot overwrite new bytes' }))
    expect(view.result.current.recovery).toBe('blocked')
    expect(sessionStorage.getItem(key)).toBe(raw)
  })
  it('recovers changed raw state after unmount and a route-alias remount with the same owner', () => {
    const view = renderHook(useReportWorkspaceDraft, { initialProps: options() })
    const changed = { ...workspaceSnapshot(), name: 'Unfinished by contract' }; view.rerender(options(changed)); view.unmount()
    const next = renderHook(useReportWorkspaceDraft, { initialProps: options() })
    expect(next.result.current.pendingSnapshot).toEqual(changed)
  })
})
