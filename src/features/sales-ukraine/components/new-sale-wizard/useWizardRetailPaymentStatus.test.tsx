import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SalesUkraineRetailPaymentStatus, SalesUkraineSale } from '../../types'
import { useWizardRetailPaymentStatus } from './useWizardRetailPaymentStatus'

const mocks = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../../api/salesUkraineApi', () => ({ getRetailPaymentStatusBySaleId: mocks.load }))
beforeEach(() => { mocks.load.mockReset() })
afterEach(cleanup)
const sale: SalesUkraineSale = { Id: 1, RetailClient: { Id: 10 } }
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}

describe('wizard retail payment status', () => {
  it('does not reload when only the sale or retail client object identity changes', async () => {
    const status = { Id: 1, Amount: 100 }
    mocks.load.mockResolvedValue(status)
    const { result, rerender } = renderHook(useWizardRetailPaymentStatus, { initialProps: sale })
    await waitFor(() => expect(result.current).toBe(status))
    rerender({ ...sale, RetailClient: { ...sale.RetailClient } })
    expect(mocks.load).toHaveBeenCalledOnce()
    rerender({ ...sale, RetailClient: undefined })
    expect(result.current).toBeNull()
  })

  it('clears previous payment status while another sale is loading', async () => {
    const pending = deferred<SalesUkraineRetailPaymentStatus>()
    mocks.load.mockResolvedValueOnce({ Id: 1, Amount: 100 }).mockReturnValueOnce(pending.promise)
    const { result, rerender } = renderHook(useWizardRetailPaymentStatus, { initialProps: sale })
    await waitFor(() => expect(result.current?.Amount).toBe(100))
    rerender({ ...sale, Id: 2 })
    expect(result.current).toBeNull()
    await act(async () => { pending.resolve({ Id: 2, Amount: 20 }) })
    expect(result.current?.Amount).toBe(20)
  })

  it('ignores a late response for the previous sale', async () => {
    const pending = deferred<SalesUkraineRetailPaymentStatus>()
    mocks.load.mockReturnValueOnce(pending.promise).mockResolvedValueOnce({ Id: 2, Amount: 20 })
    const { result, rerender } = renderHook(useWizardRetailPaymentStatus, { initialProps: sale })
    rerender({ ...sale, Id: 2 })
    await waitFor(() => expect(result.current?.Amount).toBe(20))
    await act(async () => { pending.resolve({ Id: 1, Amount: 100 }) })
    expect(result.current?.Amount).toBe(20)
  })
})
