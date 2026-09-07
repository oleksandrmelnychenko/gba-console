import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { searchValuationAgreements, type ValuationAgreement } from '../api/reportsApi'
import { useValuationAgreement } from './useValuationAgreement'

vi.mock('../api/reportsApi', () => ({ searchValuationAgreements: vi.fn() }))

describe('valuation agreement lookup lifetime', () => {
  beforeEach(() => vi.clearAllMocks())

  it('aborts an old exact-ID lookup and ignores its late response after another agreement is selected', async () => {
    let finishOld!: (items: ValuationAgreement[]) => void
    const pending = new Promise<ValuationAgreement[]>(resolve => { finishOld = resolve })
    vi.mocked(searchValuationAgreements).mockImplementation(async params => params.value === '459018' ? pending : [{ Id: 458945, Name: 'Новий договір [458945]' }])
    const { result, rerender } = renderHook(({ value }) => useValuationAgreement(value, true), { initialProps: { value: 459018 } })
    const oldSignal = vi.mocked(searchValuationAgreements).mock.calls[0][1]!
    rerender({ value: 458945 })
    await waitFor(() => expect(result.current.agreement?.Id).toBe(458945))
    expect(oldSignal.aborted).toBe(true)
    await act(async () => { finishOld([{ Id: 459018, Name: 'Старий договір [459018]' }]); await pending })
    expect(result.current.agreement?.Id).toBe(458945)
  })

  it('does not query active agreements when permission is absent', () => {
    renderHook(() => useValuationAgreement(459018, false))
    expect(searchValuationAgreements).not.toHaveBeenCalled()
  })
})
