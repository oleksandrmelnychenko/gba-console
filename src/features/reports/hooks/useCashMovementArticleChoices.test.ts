import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { getCashMovementArticleChoices } from '../api/cashMovementApi'
import { createCashMovementArticleChoicesRequest, type CashMovementArticleChoices } from '../data/cashMovementArticleChoices'
import { CASH_MOVEMENT_TEST_ARTICLE, cashMovementCapability, cashMovementArticleChoices } from '../data/cashMovement.test-fixtures'
import { useCashMovementArticleChoices } from './useCashMovementArticleChoices'
vi.mock('../api/cashMovementApi', () => ({ getCashMovementArticleChoices: vi.fn() }))
function props() { return { capability: cashMovementCapability(), period: '2026-Q3', canGenerate: true, callerKey: 'owner-a' } }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
beforeEach(() => { vi.mocked(getCashMovementArticleChoices).mockReset(); vi.mocked(getCashMovementArticleChoices).mockImplementation(async (cap, period) => ({ ...cashMovementArticleChoices(), ...createCashMovementArticleChoicesRequest(cap, period) })) })

it('loads on open, requires explicit selection and never chooses the first published entry', async () => {
  const hook = renderHook(useCashMovementArticleChoices, { initialProps: props() })
  await waitFor(() => expect(hook.result.current.available).toBe(true)); expect(hook.result.current.selectedKey).toBeNull()
  act(() => hook.result.current.select('invented-not-in-list')); expect(hook.result.current.selectedKey).toBeNull()
  act(() => hook.result.current.select(CASH_MOVEMENT_TEST_ARTICLE)); expect(hook.result.current.selectedKey).toBe(CASH_MOVEMENT_TEST_ARTICLE)
  expect(getCashMovementArticleChoices).toHaveBeenCalledOnce()
})
it.each(['permission', 'caller', 'date', 'runtime'])('does not load when %s is ineligible', reason => {
  const input = props()
  if (reason === 'permission') input.canGenerate = false
  if (reason === 'caller') input.callerKey = ''
  if (reason === 'date') input.period = '2026-09'
  if (reason === 'runtime') input.capability.Executable = false
  const hook = renderHook(useCashMovementArticleChoices, { initialProps: input })
  expect(hook.result.current.eligible).toBe(false); expect(getCashMovementArticleChoices).not.toHaveBeenCalled()
})
it.each(['receipts', 'payouts'] as const)('clears selected %s article immediately on its period change', async kind => {
  const input = { ...props(), capability: cashMovementCapability(kind), period: kind === 'receipts' ? '2026-Q3' : '2026-09' }
  const hook = renderHook(useCashMovementArticleChoices, { initialProps: input })
  await waitFor(() => expect(hook.result.current.available).toBe(true)); act(() => hook.result.current.select(CASH_MOVEMENT_TEST_ARTICLE))
  hook.rerender({ ...input, period: kind === 'receipts' ? '2026-Q4' : '2026-10' })
  expect(hook.result.current.selectedKey).toBeNull()
  await waitFor(() => expect(getCashMovementArticleChoices).toHaveBeenCalledTimes(2))
  expect(vi.mocked(getCashMovementArticleChoices).mock.calls[1][1]).not.toBe(input.period)
})
it.each(['caller', 'permission', 'definition', 'unmount'])('aborts deferred %s choices and rejects their late page', async reason => {
  const pending = deferred<CashMovementArticleChoices>(); vi.mocked(getCashMovementArticleChoices).mockReturnValueOnce(pending.promise)
  const input = props(), hook = renderHook(useCashMovementArticleChoices, { initialProps: input })
  await waitFor(() => expect(getCashMovementArticleChoices).toHaveBeenCalledOnce())
  const oldSignal = vi.mocked(getCashMovementArticleChoices).mock.calls[0][3]
  if (reason === 'unmount') hook.unmount()
  else if (reason === 'caller') hook.rerender({ ...input, callerKey: 'owner-b' })
  else if (reason === 'permission') hook.rerender({ ...input, canGenerate: false })
  else hook.rerender({ ...input, capability: { ...input.capability, SourceIdentity: Object.assign({ ...input.capability.SourceIdentity }, { DefinitionSha256: '0'.repeat(64) }) } })
  expect(oldSignal.aborted).toBe(true)
  const late = cashMovementArticleChoices(); late.Choices[0].Caption = 'Стара стаття'
  await act(async () => { pending.resolve(late) })
  if (reason !== 'unmount') expect(hook.result.current.choices.some(choice => choice.Caption === 'Стара стаття')).toBe(false)
})
it('retains duplicate captions across pages with distinct tokens and sends only the returned continuation', async () => {
  const first = cashMovementArticleChoices(); first.ContinuationKey = 'genuine-next'
  const second = cashMovementArticleChoices(); second.Choices[0].Key = 'genuine-second-choice'
  vi.mocked(getCashMovementArticleChoices).mockResolvedValueOnce(first).mockResolvedValueOnce(second)
  const hook = renderHook(useCashMovementArticleChoices, { initialProps: props() })
  await waitFor(() => expect(hook.result.current.available).toBe(true)); act(() => hook.result.current.select(CASH_MOVEMENT_TEST_ARTICLE))
  act(() => hook.result.current.loadMore()); await waitFor(() => expect(hook.result.current.choices).toHaveLength(2))
  expect(vi.mocked(getCashMovementArticleChoices).mock.calls[1][4]).toBe('genuine-next')
  expect(hook.result.current.selectedKey).toBe(CASH_MOVEMENT_TEST_ARTICLE); expect(hook.result.current.continuation).toBeNull()
})
it('allows a genuinely empty page with continuation without inventing a choice or auto-reading more', async () => {
  vi.mocked(getCashMovementArticleChoices).mockResolvedValueOnce({ ...cashMovementArticleChoices(), Choices: [], ContinuationKey: 'empty-next' })
  const hook = renderHook(useCashMovementArticleChoices, { initialProps: props() })
  await waitFor(() => expect(hook.result.current.available).toBe(true))
  expect(hook.result.current.choices).toEqual([]); expect(hook.result.current.continuation).toBe('empty-next'); expect(hook.result.current.selectedKey).toBeNull()
  expect(getCashMovementArticleChoices).toHaveBeenCalledOnce()
})
it.each(['duplicate', 'cycle', 'pending'])('closes selection after a %s continuation instead of mixing generations', async reason => {
  const first = cashMovementArticleChoices(); first.ContinuationKey = 'genuine-next'
  const second = cashMovementArticleChoices()
  if (reason === 'cycle') { second.Choices[0].Key = 'different-key'; second.ContinuationKey = 'genuine-next' }
  if (reason === 'pending') { second.Available = false; second.Choices = [] }
  vi.mocked(getCashMovementArticleChoices).mockResolvedValueOnce(first).mockResolvedValueOnce(second)
  const hook = renderHook(useCashMovementArticleChoices, { initialProps: props() })
  await waitFor(() => expect(hook.result.current.available).toBe(true)); act(() => hook.result.current.select(CASH_MOVEMENT_TEST_ARTICLE))
  act(() => hook.result.current.loadMore()); await waitFor(() => expect(hook.result.current.loading).toBe(false))
  expect(hook.result.current.selectedKey).toBeNull(); expect(hook.result.current.choices).toEqual([])
  if (reason === 'pending') expect(hook.result.current.available).toBe(false); else expect(hook.result.current.error).toContain('Оновіть')
})
it('refresh aborts an outstanding continuation and clears selection before any replacement list arrives', async () => {
  const first = cashMovementArticleChoices(); first.ContinuationKey = 'genuine-next'; const pending = deferred<CashMovementArticleChoices>()
  vi.mocked(getCashMovementArticleChoices).mockResolvedValueOnce(first).mockReturnValueOnce(pending.promise)
  const hook = renderHook(useCashMovementArticleChoices, { initialProps: props() })
  await waitFor(() => expect(hook.result.current.available).toBe(true)); act(() => hook.result.current.select(CASH_MOVEMENT_TEST_ARTICLE))
  act(() => hook.result.current.loadMore()); const oldSignal = vi.mocked(getCashMovementArticleChoices).mock.calls[1][3]
  act(() => hook.result.current.refresh()); expect(oldSignal.aborted).toBe(true); expect(hook.result.current.selectedKey).toBeNull()
  const late = cashMovementArticleChoices(); late.Choices[0].Caption = 'Застаріла сторінка'
  await act(async () => { pending.resolve(late) }); expect(hook.result.current.choices.some(choice => choice.Caption === 'Застаріла сторінка')).toBe(false)
})
it('does not start a second next-page request on repeated clicks while the first is pending', async () => {
  const first = cashMovementArticleChoices(); first.ContinuationKey = 'genuine-next'; const pending = deferred<CashMovementArticleChoices>()
  vi.mocked(getCashMovementArticleChoices).mockResolvedValueOnce(first).mockReturnValueOnce(pending.promise)
  const hook = renderHook(useCashMovementArticleChoices, { initialProps: props() })
  await waitFor(() => expect(hook.result.current.available).toBe(true))
  act(() => { hook.result.current.loadMore(); hook.result.current.loadMore() })
  expect(getCashMovementArticleChoices).toHaveBeenCalledTimes(2)
  const page = cashMovementArticleChoices(); page.Choices = []; await act(async () => { pending.resolve(page) })
})

it('clears optional selection explicitly and refuses a key that was not delivered', async () => {
  const hook = renderHook(useCashMovementArticleChoices, { initialProps: props() })
  await waitFor(() => expect(hook.result.current.available).toBe(true)); act(() => hook.result.current.select(CASH_MOVEMENT_TEST_ARTICLE))
  expect(hook.result.current.selectedCaption).toBe(cashMovementArticleChoices().Choices[0].Caption)
  act(() => hook.result.current.select('')); expect(hook.result.current.selectedKey).toBeNull()
  act(() => hook.result.current.select('invented')); expect(hook.result.current.selectedKey).toBeNull()
})
it('keeps missing full normal identity pending without a fabricated article', async () => {
  vi.mocked(getCashMovementArticleChoices).mockResolvedValueOnce({ ...cashMovementArticleChoices(), Available: false, Code: 'cash_article_normal_identity_unavailable', Choices: [] })
  const hook = renderHook(useCashMovementArticleChoices, { initialProps: props() })
  await waitFor(() => expect(hook.result.current.available).toBe(false)); expect(hook.result.current.choices).toEqual([])
  expect(hook.result.current.selectedKey).toBeNull()
})
it('closes a stale continuation with an explicit reselection notice and no automatic retry', async () => {
  const first = cashMovementArticleChoices(); first.ContinuationKey = 'genuine-next'
  vi.mocked(getCashMovementArticleChoices).mockResolvedValueOnce(first).mockRejectedValueOnce(new ApiError('changed', 409, null))
  const hook = renderHook(useCashMovementArticleChoices, { initialProps: props() })
  await waitFor(() => expect(hook.result.current.available).toBe(true)); act(() => hook.result.current.select(CASH_MOVEMENT_TEST_ARTICLE))
  act(() => hook.result.current.loadMore()); await waitFor(() => expect(hook.result.current.error).toContain('Оновіть'))
  expect(hook.result.current.selectedKey).toBeNull(); expect(hook.result.current.choices).toEqual([])
  expect(getCashMovementArticleChoices).toHaveBeenCalledTimes(2)
})
