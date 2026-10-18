import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { getServerReportTemplates, saveServerReportTemplate } from '../api/reportWorkspaceApi'
import { createSalesReportPreset } from '../data/reportPresets'
import { useServerReportTemplates } from './useServerReportTemplates'

vi.mock('../api/reportWorkspaceApi', () => ({ getServerReportTemplates: vi.fn(), saveServerReportTemplate: vi.fn(), deleteServerReportTemplate: vi.fn() }))
const template = { ...createSalesReportPreset('daily', '2026-09-01', '2026-09-07', []), Id: crypto.randomUUID(), Revision: 1 }
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); vi.mocked(getServerReportTemplates).mockResolvedValue([]) })

it('clears old success feedback without losing the saved template', async () => {
  const { result } = renderHook(() => useServerReportTemplates(true))
  await waitFor(() => expect(result.current.ready).toBe(true))
  vi.mocked(saveServerReportTemplate).mockResolvedValue(template)
  vi.mocked(getServerReportTemplates).mockResolvedValue([template])
  await act(() => result.current.save(template.Name, template.Data))
  expect(result.current.noticeKind).toBe('success')
  expect(result.current.notice).toBe('Шаблон збережено.')
  act(() => result.current.clearNotice())
  expect(result.current.notice).toBeNull()
  expect(result.current.templates).toEqual([template])
})

it('preserves failed-load feedback on reopening and clears it when retrying', async () => {
  vi.mocked(getServerReportTemplates).mockRejectedValueOnce(new Error('Немає з’єднання'))
  const { result } = renderHook(() => useServerReportTemplates(true))
  await waitFor(() => expect(result.current.noticeKind).toBe('error'))
  act(() => result.current.clearNotice())
  expect(result.current.notice).toBe('Немає з’єднання')
  expect(result.current.ready).toBe(false)
  act(() => result.current.reload())
  expect(result.current.notice).toBeNull()
  await waitFor(() => expect(result.current.ready).toBe(true))
})

it('reports a committed save with a failed refresh as an error without retrying the write', async () => {
  const { result } = renderHook(() => useServerReportTemplates(true))
  await waitFor(() => expect(result.current.ready).toBe(true))
  vi.mocked(saveServerReportTemplate).mockResolvedValue(template)
  vi.mocked(getServerReportTemplates).mockRejectedValueOnce(new Error('Немає з’єднання'))
  await act(async () => expect(await result.current.save(template.Name, template.Data)).toEqual({ ok: true, template }))
  expect(result.current.noticeKind).toBe('error')
  expect(result.current.ready).toBe(false)
  expect(saveServerReportTemplate).toHaveBeenCalledOnce()
  act(() => result.current.clearNotice())
  expect(result.current.notice).toContain('Не вдалося оновити список')
})
