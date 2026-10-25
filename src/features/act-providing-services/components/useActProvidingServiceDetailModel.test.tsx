import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { updateActProvidingService } from '../api/actProvidingServicesApi'
import type { ActProvidingService } from '../types'
import { useActProvidingServiceDetailModel } from './useActProvidingServiceDetailModel'

vi.mock('../api/actProvidingServicesApi', () => ({
  getActProvidingService: vi.fn(),
  updateActProvidingService: vi.fn(),
}))

describe('act save submission guard', () => {
  it('saves once while pending and permits another save after completion', async () => {
    const document: ActProvidingService = { Id: 1, NetUid: 'act-1', FromDate: '2026-10-01T10:00:00Z', Comment: 'Before' }
    const load = vi.fn().mockResolvedValue(document)
    let finish!: (value: ActProvidingService) => void
    vi.mocked(updateActProvidingService).mockReset()
    vi.mocked(updateActProvidingService).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const { result } = renderHook(() => useActProvidingServiceDetailModel('act-1', load, true), { wrapper: I18nProvider })
    await waitFor(() => { expect(result.current.isLoading).toBe(false); expect(result.current.act).toEqual(document) })
    act(() => { result.current.updateComment('After') })
    let pending!: Promise<unknown> | undefined
    act(() => {
      pending = result.current.save()
      for (let index = 0; index < 10; index += 1) result.current.save()
    })
    expect(updateActProvidingService).toHaveBeenCalledTimes(1)
    expect(result.current.isSaving).toBe(true)
    await act(async () => { finish({ ...document, Comment: 'After' }); await pending })
    expect(result.current.isSaving).toBe(false)
    expect(result.current.comment).toBe('After')
    vi.mocked(updateActProvidingService).mockResolvedValue(document)
    await act(async () => { await result.current.save() })
    expect(updateActProvidingService).toHaveBeenCalledTimes(2)
  })
})
