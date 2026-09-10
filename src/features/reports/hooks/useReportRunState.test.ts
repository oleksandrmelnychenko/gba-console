import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ReportResult } from '../types'
import { useReportRunState } from './useReportRunState'

const resultFile: ReportResult = { document: { DocumentURL: '/files/agreement-42.xlsx' }, raw: {} }
const key = (agreement: number, allowed = true) => JSON.stringify({ agreement, allowed })

describe('report files bound to their submitted request', () => {
  it('rejects a pending response after explicitly clearing the same configuration', () => {
    const { result } = renderHook(() => useReportRunState<object>(key(42)))
    let pending!: ReturnType<typeof result.current.begin>
    act(() => { pending = result.current.begin() })
    act(() => result.current.clear())
    act(() => pending({ result: resultFile, downloadModalOpened: true }))
    expect(result.current).toMatchObject({ result: null, lastRun: null, error: null, isLoading: false, downloadModalOpened: false })
  })

  it('clears the previous export on a new run and accepts only the latest attempt for identical parameters', () => {
    const { result } = renderHook(() => useReportRunState<object>(key(42)))
    act(() => result.current.update({ result: resultFile, lastRun: { agreement: 42 }, downloadModalOpened: true }))
    let first!: ReturnType<typeof result.current.begin>
    let second!: ReturnType<typeof result.current.begin>
    act(() => { first = result.current.begin() })
    expect(result.current).toMatchObject({ result: null, lastRun: null, error: null, isLoading: true, downloadModalOpened: false })
    act(() => { second = result.current.begin() })
    act(() => second({ result: resultFile, isLoading: false, downloadModalOpened: true }))
    act(() => first({ result: null, error: 'late failure', isLoading: false, downloadModalOpened: false }))
    expect(result.current).toMatchObject({ result: resultFile, error: null, isLoading: false, downloadModalOpened: true })
  })

  it('keeps the accepted result through unrelated rerenders', () => {
    const { result, rerender } = renderHook(({ request }) => useReportRunState<{ agreement: number }>(request), { initialProps: { request: key(42) } })
    act(() => result.current.update({ result: resultFile, lastRun: { agreement: 42 }, downloadModalOpened: true }))
    rerender({ request: key(42) })
    expect(result.current.result).toBe(resultFile)
    expect(result.current.lastRun).toEqual({ agreement: 42 })
    act(() => result.current.update({ downloadModalOpened: false }))
    expect(result.current.result).toBe(resultFile)
    expect(result.current.downloadModalOpened).toBe(false)
  })

  it('immediately removes previous files, description, error and loading state after changing a contract', () => {
    const { result, rerender } = renderHook(({ request }) => useReportRunState<object>(request), { initialProps: { request: key(42) } })
    act(() => result.current.update({ result: resultFile, lastRun: { agreement: 42 }, error: 'old error', isLoading: true, downloadModalOpened: true }))
    rerender({ request: key(43) })
    expect(result.current).toMatchObject({ result: null, lastRun: null, error: null, isLoading: false, downloadModalOpened: false })
  })

  it('rejects a late old response even after switching back to the original contract', () => {
    const { result, rerender } = renderHook(({ request }) => useReportRunState<object>(request), { initialProps: { request: key(42) } })
    const previousUpdate = result.current.update
    act(() => previousUpdate({ isLoading: true }))
    rerender({ request: key(43) })
    rerender({ request: key(42) })
    act(() => result.current.update({ isLoading: true }))
    act(() => previousUpdate({ result: resultFile, lastRun: { agreement: 42 }, isLoading: false, downloadModalOpened: true }))
    expect(result.current).toMatchObject({ result: null, lastRun: null, isLoading: true, downloadModalOpened: false })
    act(() => result.current.update({ result: resultFile, lastRun: { agreement: 42 }, isLoading: false }))
    expect(result.current.result).toBe(resultFile)
  })

  it('does not restore a previous file after permission is revoked and later restored', () => {
    const { result, rerender } = renderHook(({ request }) => useReportRunState<object>(request), { initialProps: { request: key(42) } })
    const previousUpdate = result.current.update
    act(() => previousUpdate({ result: resultFile, downloadModalOpened: true }))
    rerender({ request: key(42, false) })
    rerender({ request: key(42, true) })
    act(() => previousUpdate({ error: 'late error', downloadModalOpened: true }))
    expect(result.current).toMatchObject({ result: null, lastRun: null, error: null, downloadModalOpened: false })
  })
})
