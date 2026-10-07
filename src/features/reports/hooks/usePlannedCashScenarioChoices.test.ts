import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { getPlannedCashScenarioChoices } from '../api/plannedCashApi'
import { createPlannedCashScenarioChoicesRequest, type PlannedCashScenarioChoices } from '../data/plannedCashScenarioChoices'
import { PLANNED_CASH_TEST_CHOICE, plannedCashCapability, plannedCashChoices, plannedCashFilters } from '../data/plannedCash.test-fixtures'
import { usePlannedCashScenarioChoices } from './usePlannedCashScenarioChoices'
vi.mock('../api/plannedCashApi', () => ({ getPlannedCashScenarioChoices: vi.fn() }))
function props() { return { capability: plannedCashCapability('DdsPayouts'), filters: plannedCashFilters(), canGenerate: true, callerKey: 'owner-a' } }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
beforeEach(() => { vi.mocked(getPlannedCashScenarioChoices).mockReset(); vi.mocked(getPlannedCashScenarioChoices).mockImplementation(async (cap, filters) => ({ ...plannedCashChoices(cap.Kind), ...createPlannedCashScenarioChoicesRequest(cap, filters) })) })

it('loads on open, requires explicit selection and never chooses the first published entry', async () => {
  const hook = renderHook(usePlannedCashScenarioChoices, { initialProps: props() })
  await waitFor(() => expect(hook.result.current.available).toBe(true)); expect(hook.result.current.selectedKey).toBeNull()
  act(() => hook.result.current.select('invented-not-in-list')); expect(hook.result.current.selectedKey).toBeNull()
  act(() => hook.result.current.select(PLANNED_CASH_TEST_CHOICE)); expect(hook.result.current.selectedKey).toBe(PLANNED_CASH_TEST_CHOICE)
  expect(getPlannedCashScenarioChoices).toHaveBeenCalledOnce()
})
it.each(['permission', 'caller', 'date', 'calendar'])('does not load when %s is ineligible', reason => {
  const input = props()
  if (reason === 'permission') input.canGenerate = false
  if (reason === 'caller') input.callerKey = ''
  if (reason === 'date') input.filters.PreviousFrom = '2026-02-30'
  if (reason === 'calendar') input.capability = plannedCashCapability()
  const hook = renderHook(usePlannedCashScenarioChoices, { initialProps: input })
  expect(hook.result.current.eligible).toBe(false); expect(getPlannedCashScenarioChoices).not.toHaveBeenCalled()
})
it.each(['From', 'ThroughExclusive', 'PreviousFrom', 'PreviousThroughExclusive'] as const)('clears selection immediately after %s changes and loads the new exact scope', async key => {
  const input = props(), hook = renderHook(usePlannedCashScenarioChoices, { initialProps: input })
  await waitFor(() => expect(hook.result.current.available).toBe(true)); act(() => hook.result.current.select(PLANNED_CASH_TEST_CHOICE))
  hook.rerender({ ...input, filters: { ...input.filters, [key]: key.endsWith('Exclusive') ? '2026-10-02' : '2026-08-02' } })
  expect(hook.result.current.selectedKey).toBeNull()
  await waitFor(() => expect(getPlannedCashScenarioChoices).toHaveBeenCalledTimes(2))
  expect(vi.mocked(getPlannedCashScenarioChoices).mock.calls[1][1][key]).not.toBe(input.filters[key])
})
it.each(['caller', 'permission', 'definition', 'unmount'])('aborts deferred %s choices and rejects their late page', async reason => {
  const pending = deferred<PlannedCashScenarioChoices>(); vi.mocked(getPlannedCashScenarioChoices).mockReturnValueOnce(pending.promise)
  const input = props(), hook = renderHook(usePlannedCashScenarioChoices, { initialProps: input })
  await waitFor(() => expect(getPlannedCashScenarioChoices).toHaveBeenCalledOnce())
  const oldSignal = vi.mocked(getPlannedCashScenarioChoices).mock.calls[0][3]
  if (reason === 'unmount') hook.unmount()
  else if (reason === 'caller') hook.rerender({ ...input, callerKey: 'owner-b' })
  else if (reason === 'permission') hook.rerender({ ...input, canGenerate: false })
  else hook.rerender({ ...input, capability: { ...input.capability, SourceIdentity: { ...input.capability.SourceIdentity, DefinitionSha256: '0'.repeat(64) } } })
  expect(oldSignal.aborted).toBe(true)
  const late = plannedCashChoices(); late.Choices[0].Caption = 'Старий користувач'
  await act(async () => { pending.resolve(late) })
  if (reason !== 'unmount') expect(hook.result.current.choices.some(choice => choice.Caption === 'Старий користувач')).toBe(false)
})
it('retains duplicate captions across pages with distinct tokens and sends only the returned continuation', async () => {
  const first = plannedCashChoices(); first.ContinuationKey = 'genuine-next'
  const second = plannedCashChoices(); second.Choices[0].Key = 'genuine-second-choice'
  vi.mocked(getPlannedCashScenarioChoices).mockResolvedValueOnce(first).mockResolvedValueOnce(second)
  const hook = renderHook(usePlannedCashScenarioChoices, { initialProps: props() })
  await waitFor(() => expect(hook.result.current.available).toBe(true)); act(() => hook.result.current.select(PLANNED_CASH_TEST_CHOICE))
  act(() => hook.result.current.loadMore()); await waitFor(() => expect(hook.result.current.choices).toHaveLength(2))
  expect(vi.mocked(getPlannedCashScenarioChoices).mock.calls[1][4]).toBe('genuine-next')
  expect(hook.result.current.selectedKey).toBe(PLANNED_CASH_TEST_CHOICE); expect(hook.result.current.continuation).toBeNull()
})
it('allows a genuinely empty page with continuation without inventing a choice or auto-reading more', async () => {
  vi.mocked(getPlannedCashScenarioChoices).mockResolvedValueOnce({ ...plannedCashChoices(), Choices: [], ContinuationKey: 'empty-next' })
  const hook = renderHook(usePlannedCashScenarioChoices, { initialProps: props() })
  await waitFor(() => expect(hook.result.current.available).toBe(true))
  expect(hook.result.current.choices).toEqual([]); expect(hook.result.current.continuation).toBe('empty-next'); expect(hook.result.current.selectedKey).toBeNull()
  expect(getPlannedCashScenarioChoices).toHaveBeenCalledOnce()
})
it.each(['duplicate', 'cycle', 'pending'])('closes selection after a %s continuation instead of mixing generations', async reason => {
  const first = plannedCashChoices(); first.ContinuationKey = 'genuine-next'
  const second = plannedCashChoices()
  if (reason === 'cycle') { second.Choices[0].Key = 'different-key'; second.ContinuationKey = 'genuine-next' }
  if (reason === 'pending') { second.Available = false; second.Choices = [] }
  vi.mocked(getPlannedCashScenarioChoices).mockResolvedValueOnce(first).mockResolvedValueOnce(second)
  const hook = renderHook(usePlannedCashScenarioChoices, { initialProps: props() })
  await waitFor(() => expect(hook.result.current.available).toBe(true)); act(() => hook.result.current.select(PLANNED_CASH_TEST_CHOICE))
  act(() => hook.result.current.loadMore()); await waitFor(() => expect(hook.result.current.loading).toBe(false))
  expect(hook.result.current.selectedKey).toBeNull(); expect(hook.result.current.choices).toEqual([])
  if (reason === 'pending') expect(hook.result.current.available).toBe(false); else expect(hook.result.current.error).toContain('Оновіть')
})
it('refresh aborts an outstanding continuation and clears selection before any replacement list arrives', async () => {
  const first = plannedCashChoices(); first.ContinuationKey = 'genuine-next'; const pending = deferred<PlannedCashScenarioChoices>()
  vi.mocked(getPlannedCashScenarioChoices).mockResolvedValueOnce(first).mockReturnValueOnce(pending.promise)
  const hook = renderHook(usePlannedCashScenarioChoices, { initialProps: props() })
  await waitFor(() => expect(hook.result.current.available).toBe(true)); act(() => hook.result.current.select(PLANNED_CASH_TEST_CHOICE))
  act(() => hook.result.current.loadMore()); const oldSignal = vi.mocked(getPlannedCashScenarioChoices).mock.calls[1][3]
  act(() => hook.result.current.refresh()); expect(oldSignal.aborted).toBe(true); expect(hook.result.current.selectedKey).toBeNull()
  const late = plannedCashChoices(); late.Choices[0].Caption = 'Застаріла сторінка'
  await act(async () => { pending.resolve(late) }); expect(hook.result.current.choices.some(choice => choice.Caption === 'Застаріла сторінка')).toBe(false)
})
it('does not start a second next-page request on repeated clicks while the first is pending', async () => {
  const first = plannedCashChoices(); first.ContinuationKey = 'genuine-next'; const pending = deferred<PlannedCashScenarioChoices>()
  vi.mocked(getPlannedCashScenarioChoices).mockResolvedValueOnce(first).mockReturnValueOnce(pending.promise)
  const hook = renderHook(usePlannedCashScenarioChoices, { initialProps: props() })
  await waitFor(() => expect(hook.result.current.available).toBe(true))
  act(() => { hook.result.current.loadMore(); hook.result.current.loadMore() })
  expect(getPlannedCashScenarioChoices).toHaveBeenCalledTimes(2)
  const page = plannedCashChoices(); page.Choices = []; await act(async () => { pending.resolve(page) })
})
