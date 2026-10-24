import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../../shared/api/apiClient'
import { clearAllSalesPendingMutations, loadSalesPendingMutation } from '../../pendingSalesMutationRegistry'
import { getSaleFileMutationContext, SALE_FILE_MUTATION_SURFACES } from '../../saleFileMutation'
import { installSalesMutationStorageHarness, type SalesMutationStorageHarness } from '../../salesMutationStorageTestHarness'
import type { SalesUkraineSale } from '../../types'
import { clearAllWizardSplitRecoveries, clearWizardMergedSale } from './newSaleWizardState'
import { useWizardSaleSubmission, type WizardSaleSubmissionOptions } from './useWizardSaleSubmission'

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), apiRequest: vi.fn(), notify: vi.fn(), t: (key: string) => key }))
vi.mock('../../api/salesUkraineApi', async (original) => ({
  ...await original<typeof import('../../api/salesUkraineApi')>(),
  createSalesUkraineSaleFromData: mocks.create,
  updateSaleFromData: mocks.update,
}))
vi.mock('../../../../shared/api/apiClient', async (original) => ({
  ...await original<typeof import('../../../../shared/api/apiClient')>(), apiRequest: mocks.apiRequest,
}))
vi.mock('../../../auth/useAuth', () => ({ useAuth: () => ({ session: { userNetUid: 'USER-A' } }) }))
vi.mock('../../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.t }) }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notify } }))

const sale: SalesUkraineSale = {
  NetUid: 'sale-1', Id: 10, BaseLifeCycleStatus: { SaleLifeCycleType: 0 },
  ClientAgreement: { NetUid: 'agreement-1', Client: { NetUid: 'client-1' } },
  Order: { OrderItems: [] },
}
const scope = {
  context: getSaleFileMutationContext(sale, SALE_FILE_MUTATION_SURFACES.wizard),
  kind: 'sale-update-file', userKey: 'net:user-a',
} as const
let storage: SalesMutationStorageHarness
beforeEach(() => {
  storage = installSalesMutationStorageHarness()
  clearAllSalesPendingMutations()
  clearAllWizardSplitRecoveries()
  clearWizardMergedSale()
  mocks.create.mockReset().mockResolvedValue({ sale, message: 'created' })
  mocks.update.mockReset().mockResolvedValue({ sale, message: 'saved' })
  mocks.apiRequest.mockReset().mockResolvedValue(null)
  mocks.notify.mockClear()
})
afterEach(() => {
  cleanup()
  clearAllSalesPendingMutations()
  clearAllWizardSplitRecoveries()
  clearWizardMergedSale()
  storage.dispose()
})
function options(): WizardSaleSubmissionOptions {
  return {
    canSubmit: true, canConvertMergedToBill: false, clientNetId: 'client-1', sale, retailStatus: null,
    submitDeniedReason: 'denied', submitFlow: 'create',
    value: {
      address: { Id: 1 }, addressValue: '', city: 'Kyiv', codAmount: '', comment: 'original', department: '1',
      hasOwnTtn: false, isCashOnDelivery: false, isNewAddress: false, isNewRecipient: false,
      mobilePhone: '0500000000', recipient: { Id: 1 }, recipientName: 'Recipient', registrarStorageId: 7,
      transporter: { Id: 1 }, ttnFile: null, ttnNumber: '',
    },
    onBusyChange: vi.fn(), onClose: vi.fn(), onCreated: vi.fn(), onSaved: vi.fn(),
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}

describe('wizard final submission controller', () => {
  it('serializes repeated submits and commits before notifying completion', async () => {
    const pending = deferred<{ sale: SalesUkraineSale; message: string }>()
    mocks.create.mockReturnValueOnce(pending.promise)
    const props = options()
    props.onCreated = vi.fn(() => { expect(loadSalesPendingMutation(scope)).toBeNull() })
    const { result } = renderHook(useWizardSaleSubmission, { initialProps: props })
    let first!: Promise<void>
    act(() => { first = result.current.submitSale(); void result.current.submitSale() })
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce())
    expect(result.current.submitting).toBe(true)
    expect(loadSalesPendingMutation(scope)?.phase).toBe('submitted')
    await act(async () => { pending.resolve({ sale, message: 'created' }); await first })
    expect(props.onCreated).toHaveBeenCalledOnce()
    expect(props.onClose).toHaveBeenCalledOnce()
    expect(result.current.submitting).toBe(false)
  })

  it.each(['context', 'unmount'] as const)('does not complete the visible flow after %s changes during submission', async (change) => {
    const pending = deferred<{ sale: SalesUkraineSale; message: string }>()
    mocks.create.mockReturnValueOnce(pending.promise)
    const props = options()
    const { result, rerender, unmount } = renderHook(useWizardSaleSubmission, { initialProps: props })
    let request!: Promise<void>
    act(() => { request = result.current.submitSale() })
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce())
    if (change === 'unmount') unmount()
    else rerender({ ...props, sale: { ...sale, NetUid: 'sale-2' } })
    await act(async () => { pending.resolve({ sale, message: 'created' }); await request })
    expect(loadSalesPendingMutation(scope)).toBeNull()
    expect(props.onCreated).not.toHaveBeenCalled()
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('retries the frozen body with the same key after a lost response and edited form', async () => {
    mocks.create.mockRejectedValueOnce(new ApiError('response lost', 503, null))
    const props = options()
    const { result, rerender } = renderHook(useWizardSaleSubmission, { initialProps: props })
    await act(async () => { await result.current.submitSale() })
    expect(result.current.finalSubmitOutcomePending).toBe(true)
    const first = mocks.create.mock.calls[0]
    expect(loadSalesPendingMutation(scope)).not.toBeNull()
    rerender({ ...props, value: { ...props.value, comment: 'edited after uncertain response' } })
    await act(async () => { await result.current.submitSale() })
    expect(mocks.create).toHaveBeenCalledTimes(2)
    expect(mocks.create.mock.calls[1][0]).toEqual(first[0])
    expect(mocks.create.mock.calls[1][2].operationId).toBe(first[2].operationId)
    expect(props.onCreated).toHaveBeenCalledOnce()
    expect(loadSalesPendingMutation(scope)).toBeNull()
  })

  it('keeps draft saving separate from final creation and closing', async () => {
    const props = options()
    const { result } = renderHook(useWizardSaleSubmission, { initialProps: props })
    await act(async () => { expect(await result.current.saveSale()).toBe(true) })
    expect(mocks.update).toHaveBeenCalledOnce()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(props.onSaved).toHaveBeenCalledWith(sale)
    expect(props.onCreated).not.toHaveBeenCalled()
    expect(props.onClose).not.toHaveBeenCalled()
  })
})
