import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../api/apiClient'
import {
  isSystemOfRecordCutoverActive,
  normalizeSystemOfRecordCutover,
  resetSystemOfRecordCutoverForTests,
  useSystemOfRecordCutover,
} from './systemOfRecordCutover'

vi.mock('../api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

function CutoverProbe() {
  const state = useSystemOfRecordCutover()
  return <output data-testid="cutover">{JSON.stringify(state)}</output>
}

describe('system-of-record cutover state', () => {
  afterEach(() => {
    apiRequestMock.mockReset()
    resetSystemOfRecordCutoverForTests()
  })

  it('normalizes the server state and ignores a cutover time when inactive', () => {
    expect(normalizeSystemOfRecordCutover({ IsActive: true, CutoverUtc: '2026-11-01T00:00:00Z' })).toEqual({
      cutoverUtc: '2026-11-01T00:00:00Z',
      isActive: true,
      loaded: true,
    })
    expect(normalizeSystemOfRecordCutover({ IsActive: false, CutoverUtc: '2026-11-01T00:00:00Z' })).toEqual({
      cutoverUtc: null,
      isActive: false,
      loaded: true,
    })
    expect(normalizeSystemOfRecordCutover(null)).toEqual({ cutoverUtc: null, isActive: false, loaded: true })
  })

  it('loads the cutover once for every subscriber and re-renders them', async () => {
    apiRequestMock.mockResolvedValue({ IsActive: true, CutoverUtc: '2026-11-01T00:00:00Z' })

    render(<><CutoverProbe /><CutoverProbe /></>)

    await waitFor(() => expect(isSystemOfRecordCutoverActive()).toBe(true))
    expect(apiRequestMock).toHaveBeenCalledTimes(1)
    expect(apiRequestMock).toHaveBeenCalledWith('/data/sync/cutover')
    for (const probe of screen.getAllByTestId('cutover')) {
      expect(JSON.parse(probe.textContent || '{}')).toMatchObject({ isActive: true, loaded: true })
    }
  })

  it('keeps the pre-cutover behaviour when the state cannot be read', async () => {
    apiRequestMock.mockRejectedValue(new Error('offline'))

    render(<CutoverProbe />)

    await act(async () => {
      await Promise.resolve()
    })
    expect(isSystemOfRecordCutoverActive()).toBe(false)
    expect(JSON.parse(screen.getByTestId('cutover').textContent || '{}')).toMatchObject({ isActive: false, loaded: false })
  })
})
