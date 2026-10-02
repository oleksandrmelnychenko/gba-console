import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { clearSession, saveSession } from '../../../shared/auth/session'
import { getReportTemplateOrderState, orderReportTemplates } from '../api/reportTemplateOrderApi'
import { deleteServerReportTemplate, getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { createSalesReportPreset } from '../data/reportPresets'
import type { ReportTemplateOrderState } from '../data/reportTemplateOrder'
import type { ReportTemplate } from '../types'
import { useServerReportTemplates } from './useServerReportTemplates'

vi.mock('../api/reportWorkspaceApi', () => ({ getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn(), deleteServerReportTemplate: vi.fn() }))
vi.mock('../api/reportTemplateOrderApi', () => ({ getReportTemplateOrderState: vi.fn(), orderReportTemplates: vi.fn() }))
const session = { userNetUid: 'caller-a', csrfToken: 'csrf-a' }
const first = { ...createSalesReportPreset('daily', '', '', []), Id: '11111111-1111-1111-1111-111111111111', Name: 'Я', Revision: 3 }
const second = { ...createSalesReportPreset('agreements', '', '', []), Id: '22222222-2222-2222-2222-222222222222', Name: 'А', Revision: 7 }
const state = (definitions: ReportTemplate[] = [first, second], ListRevision = 9): ReportTemplateOrderState => ({ ListRevision,
  Items: definitions.map((item, index) => ({ Id: item.Id!, Name: item.Name, Revision: item.Revision!, DisplayOrder: index + 1 })) })
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); saveSession(session)
  vi.mocked(getServerReportTemplates).mockResolvedValue([first, second])
  vi.mocked(getReportTemplateOrderState).mockResolvedValue(state())
})
afterEach(() => { clearSession(); vi.restoreAllMocks() })
async function opened() {
  const hook = renderHook(() => useServerReportTemplates(true, [], session.userNetUid))
  await waitFor(() => expect(hook.result.current.ready).toBe(true))
  await act(async () => { expect(await hook.result.current.ordering.open()).toEqual({ ok: true }) })
  return hook
}

it('loads ordering only when opened and binds the complete list without modifying settings', async () => {
  const { result } = renderHook(() => useServerReportTemplates(true, [], session.userNetUid))
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(getReportTemplateOrderState).not.toHaveBeenCalled()
  const before = JSON.stringify(result.current.templates)
  await act(async () => { await result.current.ordering.open() })
  expect(result.current.ordering.state).toEqual(state())
  expect(JSON.stringify(result.current.templates)).toBe(before)
  expect(orderReportTemplates).not.toHaveBeenCalled(); expect(saveServerReportTemplate).not.toHaveBeenCalled()
})

it('retries only a read when separate snapshots disagree and applies the matching newer definition', async () => {
  const { result } = renderHook(() => useServerReportTemplates(true, [], session.userNetUid))
  await waitFor(() => expect(result.current.ready).toBe(true))
  const newer = { ...first, Revision: 4, Name: 'Перейменовано' }
  vi.mocked(getServerReportTemplates).mockResolvedValueOnce([first, second]).mockResolvedValueOnce([newer, second])
  vi.mocked(getReportTemplateOrderState).mockResolvedValue(state([newer, second], 10))
  await act(async () => { expect(await result.current.ordering.open()).toEqual({ ok: true }) })
  expect(getReportTemplateOrderState).toHaveBeenCalledTimes(2)
  expect(result.current.templates[0]).toBe(newer)
  expect(orderReportTemplates).not.toHaveBeenCalled()
})

it('refuses persistent mismatched metadata after exactly two reads and disables stale commands', async () => {
  const { result } = renderHook(() => useServerReportTemplates(true, [], session.userNetUid))
  await waitFor(() => expect(result.current.ready).toBe(true))
  vi.mocked(getReportTemplateOrderState).mockResolvedValue(state([{ ...first, Revision: 4 }, second], 10))
  await act(async () => { expect(await result.current.ordering.open()).toEqual({ ok: false }) })
  expect(getReportTemplateOrderState).toHaveBeenCalledTimes(2)
  expect(result.current.ready).toBe(false); expect(result.current.ordering.state).toBeNull()
  await act(async () => { expect(await result.current.ordering.change({ Operation: 'move_down', Id: first.Id })).toEqual({ ok: false }) })
  expect(orderReportTemplates).not.toHaveBeenCalled()
})

it('accepts a legitimate same-owner GET refresh and uses its new CSRF token for the order read', async () => {
  vi.mocked(getServerReportTemplates).mockImplementationOnce(async () => {
    saveSession({ ...session, csrfToken: 'refreshed' }); return [first, second]
  })
  const { result } = await opened()
  expect(result.current.ready).toBe(true)
  expect(getReportTemplateOrderState).toHaveBeenCalledWith(expect.objectContaining({ session: { userNetUid: session.userNetUid, csrfToken: 'refreshed' } }))
})

it('reorders from both fresh server snapshots while preserving definition revisions and settings bytes', async () => {
  const { result } = await opened(), bytes = JSON.stringify([first.Data, second.Data])
  vi.mocked(orderReportTemplates).mockResolvedValue(state([second, first], 10))
  vi.mocked(getServerReportTemplates).mockResolvedValue([second, first])
  vi.mocked(getReportTemplateOrderState).mockResolvedValue(state([second, first], 10))
  await act(async () => { expect(await result.current.ordering.change({ Operation: 'move_down', Id: first.Id })).toEqual({ ok: true }) })
  expect(orderReportTemplates).toHaveBeenCalledWith({ Operation: 'move_down', Id: first.Id }, 9, expect.objectContaining({ signal: expect.any(AbortSignal) }))
  expect(result.current.templates).toEqual([second, first]); expect(result.current.ordering.state?.ListRevision).toBe(10)
  expect(JSON.stringify([first.Data, second.Data])).toBe(bytes)
  expect(saveServerReportTemplate).not.toHaveBeenCalled(); expect(deleteServerReportTemplate).not.toHaveBeenCalled()
})

it('serializes ordering with ordinary mutations and prevents a second order write while pending', async () => {
  const { result } = await opened()
  let release!: (value: ReportTemplateOrderState) => void
  vi.mocked(orderReportTemplates).mockReturnValueOnce(new Promise(resolve => { release = resolve }))
  let pending!: ReturnType<typeof result.current.ordering.change>
  act(() => { pending = result.current.ordering.change({ Operation: 'sort_name_asc' }) })
  await act(async () => {
    expect(await result.current.rename(first, 'Новий')).toEqual({ ok: false })
    expect(await result.current.ordering.change({ Operation: 'sort_name_desc' })).toEqual({ ok: false })
    result.current.ordering.close()
  })
  expect(result.current.ordering.opened).toBe(true); expect(orderReportTemplates).toHaveBeenCalledOnce()
  vi.mocked(getReportTemplateOrderState).mockResolvedValue(state([first, second], 10))
  await act(async () => { release(state([first, second], 10)); expect(await pending).toEqual({ ok: true }) })
  expect(saveServerReportTemplate).not.toHaveBeenCalled()
})

it('refreshes after a 409 and requires another explicit action using the current list revision', async () => {
  const { result } = await opened()
  vi.mocked(orderReportTemplates).mockRejectedValueOnce(new ApiError('Conflict', 409, null))
  vi.mocked(getReportTemplateOrderState).mockResolvedValue(state([first, second], 10))
  await act(async () => { expect(await result.current.ordering.change({ Operation: 'sort_name_asc' })).toEqual({ ok: false }) })
  expect(orderReportTemplates).toHaveBeenCalledOnce(); expect(result.current.ordering.state?.ListRevision).toBe(10)
  expect(result.current.notice).toContain('Спробуйте потрібну дію ще раз')
  vi.mocked(orderReportTemplates).mockResolvedValue(state([first, second], 11))
  vi.mocked(getReportTemplateOrderState).mockResolvedValue(state([first, second], 11))
  await act(async () => { await result.current.ordering.change({ Operation: 'sort_name_asc' }) })
  expect(vi.mocked(orderReportTemplates).mock.calls.map(call => call[1])).toEqual([9, 10])
})

it('retains a committed save result when its authoritative reload fails, without retrying the write', async () => {
  const { result } = await opened(), saved = { ...first, Name: 'Нова назва', Revision: 4 }
  vi.mocked(saveServerReportTemplate).mockResolvedValue(saved)
  vi.mocked(getServerReportTemplates).mockRejectedValueOnce(new Error('Read failed'))
  await act(async () => { expect(await result.current.rename(first, saved.Name)).toEqual({ ok: true, template: saved }) })
  expect(saveServerReportTemplate).toHaveBeenCalledOnce(); expect(result.current.ready).toBe(false)
  expect(result.current.notice).toContain('Назву шаблону змінено. Не вдалося оновити список')
  expect(result.current.ordering.state).toBeNull()
})

it('does not move an updated or renamed row to the end of the server list', async () => {
  const { result } = await opened(), renamed = { ...first, Name: 'Б', Revision: 4 }
  vi.mocked(saveServerReportTemplate).mockResolvedValue(renamed)
  vi.mocked(getServerReportTemplates).mockResolvedValue([renamed, second])
  vi.mocked(getReportTemplateOrderState).mockResolvedValue(state([renamed, second], 10))
  await act(async () => { await result.current.rename(first, renamed.Name) })
  expect(result.current.templates).toEqual([renamed, second])
  expect(result.current.ordering.state?.Items[0].Revision).toBe(4)
  expect(vi.mocked(saveServerReportTemplate).mock.calls[0][0].Data).toEqual(first.Data)
})

it.each(['save', 'update', 'rename', 'copy', 'import', 'delete'])('reloads authoritative definitions and order after a committed %s', async kind => {
  let definitions: ReportTemplate[] = [first, second], listRevision = 9
  vi.mocked(getServerReportTemplates).mockImplementation(async () => definitions)
  vi.mocked(getReportTemplateOrderState).mockImplementation(async () => state(definitions, listRevision))
  vi.mocked(saveServerReportTemplate).mockImplementation(async request => {
    const index = definitions.findIndex(item => item.Id === request.Id)
    const saved = { ...request, Revision: (request.Revision ?? 0) + 1 }
    definitions = index < 0 ? [...definitions, saved] : definitions.map((item, position) => position === index ? saved : item)
    listRevision++; return saved
  })
  vi.mocked(deleteServerReportTemplate).mockImplementation(async template => {
    definitions = definitions.filter(item => item.Id !== template.Id); listRevision++
  })
  const { result } = await opened()
  const reads = vi.mocked(getServerReportTemplates).mock.calls.length
  await act(async () => {
    const outcome = kind === 'save' ? await result.current.save('Новий', first.Data)
      : kind === 'update' ? await result.current.update(first, { ...first.Data, from: '2026-09-01' })
        : kind === 'rename' ? await result.current.rename(first, 'Нова назва')
          : kind === 'copy' ? await result.current.copy(first, 'Копія')
            : kind === 'import' ? await result.current.importBrowserTemplate({ Name: 'Імпорт', Data: first.Data })
              : await result.current.remove(first.Id, first.Revision)
    expect(outcome.ok).toBe(true)
  })
  expect(getServerReportTemplates).toHaveBeenCalledTimes(reads + 1)
  expect(getReportTemplateOrderState).toHaveBeenCalledTimes(2)
  expect(result.current.templates).toEqual(definitions); expect(result.current.ordering.state).toEqual(state(definitions, 10))
  expect(orderReportTemplates).not.toHaveBeenCalled()
})

it('disables an unconfirmed mutation outcome and waits for an explicit read instead of retrying a write', async () => {
  const { result } = await opened()
  vi.mocked(orderReportTemplates).mockRejectedValueOnce(new Error('Connection dropped'))
  await act(async () => { expect(await result.current.ordering.change({ Operation: 'sort_name_asc' })).toEqual({ ok: false }) })
  expect(result.current.ready).toBe(false); expect(result.current.ordering.state).toBeNull()
  expect(result.current.notice).toContain('Не вдалося підтвердити зміну порядку')
  act(() => result.current.reload())
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(orderReportTemplates).toHaveBeenCalledOnce()
})

it('preserves a confirmed order commit when a racing definition makes its returned summary stale', async () => {
  const { result } = await opened(), newer = { ...first, Name: 'Новий', Revision: 4 }
  vi.mocked(orderReportTemplates).mockResolvedValue(state([newer, second], 10))
  vi.mocked(getServerReportTemplates).mockRejectedValueOnce(new Error('Read unavailable'))
  await act(async () => { expect(await result.current.ordering.change({ Operation: 'sort_name_asc' })).toEqual({ ok: true }) })
  expect(result.current.ready).toBe(false); expect(result.current.notice).toContain('Порядок шаблонів збережено.')
  expect(orderReportTemplates).toHaveBeenCalledOnce()
})

it.each(['permission', 'caller', 'switch-back'])('isolates a pending order response after %s changes', async kind => {
  const { result, rerender } = renderHook(({ enabled, caller }) => useServerReportTemplates(enabled, [], caller),
    { initialProps: { enabled: true, caller: session.userNetUid } })
  await waitFor(() => expect(result.current.ready).toBe(true))
  await act(async () => { await result.current.ordering.open() })
  let release!: (value: ReportTemplateOrderState) => void
  vi.mocked(orderReportTemplates).mockReturnValueOnce(new Promise(resolve => { release = resolve }))
  let pending!: ReturnType<typeof result.current.ordering.change>
  act(() => { pending = result.current.ordering.change({ Operation: 'sort_name_asc' }) })
  const signal = vi.mocked(orderReportTemplates).mock.calls[0][2].signal
  if (kind === 'permission') rerender({ enabled: false, caller: session.userNetUid })
  else {
    saveSession({ userNetUid: 'caller-b', csrfToken: 'csrf-b' }); rerender({ enabled: true, caller: 'caller-b' })
    if (kind === 'switch-back') { saveSession(session); rerender({ enabled: true, caller: session.userNetUid }) }
  }
  expect(signal.aborted).toBe(true)
  await act(async () => { release(state([second, first], 10)); expect(await pending).toEqual({ ok: false }) })
  expect(result.current.ordering.state).toBeNull(); expect(result.current.ordering.opened).toBe(false)
  expect(result.current.templates).not.toEqual([second, first]); expect(orderReportTemplates).toHaveBeenCalledOnce()
})

it('rejects an unrelated id before sending a mutation', async () => {
  const { result } = await opened()
  await act(async () => { expect(await result.current.ordering.change({ Operation: 'move_up', Id: '33333333-3333-3333-3333-333333333333' })).toEqual({ ok: false }) })
  expect(orderReportTemplates).not.toHaveBeenCalled(); expect(result.current.ready).toBe(false)
})

it.each(['permission', 'caller', 'switch-back'])('prevents an old browser import from dispatching after %s changes during its digest', async kind => {
  let release!: (value: ArrayBuffer) => void
  vi.spyOn(crypto.subtle, 'digest').mockReturnValueOnce(new Promise(resolve => { release = resolve }))
  const { result, rerender } = renderHook(({ enabled, caller }) => useServerReportTemplates(enabled, [], caller),
    { initialProps: { enabled: true, caller: session.userNetUid } })
  await waitFor(() => expect(result.current.ready).toBe(true))
  let pending!: ReturnType<typeof result.current.importBrowserTemplate>
  act(() => { pending = result.current.importBrowserTemplate({ Name: 'Імпорт', Data: first.Data }) })
  if (kind === 'permission') rerender({ enabled: false, caller: session.userNetUid })
  else {
    saveSession({ userNetUid: 'caller-b', csrfToken: 'csrf-b' }); rerender({ enabled: true, caller: 'caller-b' })
    if (kind === 'switch-back') { saveSession(session); rerender({ enabled: true, caller: session.userNetUid }) }
  }
  await act(async () => { release(new ArrayBuffer(32)); expect(await pending).toEqual({ ok: false }) })
  expect(saveServerReportTemplate).not.toHaveBeenCalled()
})

it('isolates identical browser imports in successive caller workspaces with distinct cancellation and success ownership', async () => {
  const imported = { Name: 'Імпорт', Data: first.Data }, releases: ((value: ReportTemplate) => void)[] = []
  vi.mocked(getServerReportTemplates).mockResolvedValue([])
  vi.mocked(saveServerReportTemplate).mockImplementation(() => new Promise(resolve => { releases.push(resolve) }))
  const old = renderHook(() => useServerReportTemplates(true, [], session.userNetUid))
  await waitFor(() => expect(old.result.current.ready).toBe(true))
  let previous!: ReturnType<typeof old.result.current.importBrowserTemplate>
  act(() => { previous = old.result.current.importBrowserTemplate(imported) })
  await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledTimes(1))
  old.unmount(); saveSession({ userNetUid: 'caller-b', csrfToken: 'csrf-b' })
  const current = renderHook(() => useServerReportTemplates(true, [], 'caller-b'))
  await waitFor(() => expect(current.result.current.ready).toBe(true))
  let pending!: ReturnType<typeof current.result.current.importBrowserTemplate>
  act(() => { pending = current.result.current.importBrowserTemplate(imported) })
  await waitFor(() => expect(saveServerReportTemplate).toHaveBeenCalledTimes(2))
  const [oldCall, newCall] = vi.mocked(saveServerReportTemplate).mock.calls
  expect(oldCall[0]).toEqual(newCall[0]); expect(oldCall[1]?.aborted).toBe(true)
  expect(newCall[1]).not.toBe(oldCall[1]); expect(newCall[1]?.aborted).toBe(false)
  const saved = { ...newCall[0], Revision: 1 }
  vi.mocked(getServerReportTemplates).mockResolvedValue([saved])
  await act(async () => { releases[1](saved); expect(await pending).toEqual({ ok: true, template: saved }) })
  await act(async () => { releases[0](saved); expect(await previous).toEqual({ ok: false }) })
  expect(current.result.current.templates).toEqual([saved])
})
