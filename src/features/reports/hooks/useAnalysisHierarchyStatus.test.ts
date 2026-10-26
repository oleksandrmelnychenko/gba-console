import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { getAnalysisHierarchyStatus } from '../api/currentVparivanieAnalysisApi'
import { ANALYSIS_HIERARCHY_STATUS_FAILED, loadAnalysisHierarchyStatus, resetAnalysisHierarchyStatus, useAnalysisHierarchyStatus } from './useAnalysisHierarchyStatus'
vi.mock('../api/currentVparivanieAnalysisApi', () => ({ getAnalysisHierarchyStatus: vi.fn() }))
beforeEach(() => { resetAnalysisHierarchyStatus(); vi.mocked(getAnalysisHierarchyStatus).mockReset() })

it('loads the status once per minute for every consumer and only when enabled', async () => {
  vi.mocked(getAnalysisHierarchyStatus).mockResolvedValue({ warehouseGroup: 'Немає папок.' })
  const idle = renderHook(() => useAnalysisHierarchyStatus(false))
  expect(idle.result.current).toBeNull()
  expect(getAnalysisHierarchyStatus).not.toHaveBeenCalled()
  const first = renderHook(() => useAnalysisHierarchyStatus(true))
  const second = renderHook(() => useAnalysisHierarchyStatus(true))
  await waitFor(() => expect(first.result.current).toEqual({ warehouseGroup: 'Немає папок.' }))
  await waitFor(() => expect(second.result.current).toEqual({ warehouseGroup: 'Немає папок.' }))
  expect(getAnalysisHierarchyStatus).toHaveBeenCalledTimes(1)
  await loadAnalysisHierarchyStatus(Date.now() + 61_000)
  expect(getAnalysisHierarchyStatus).toHaveBeenCalledTimes(2)
})

it('reports a truthful failure and retries on the next use', async () => {
  vi.mocked(getAnalysisHierarchyStatus).mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ warehouseGroup: null })
  expect(await loadAnalysisHierarchyStatus()).toBe(ANALYSIS_HIERARCHY_STATUS_FAILED)
  expect(await loadAnalysisHierarchyStatus()).toEqual({ warehouseGroup: null })
})
