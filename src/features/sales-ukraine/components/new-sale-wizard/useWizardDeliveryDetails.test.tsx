import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SalesUkraineSale } from '../../types'
import type { WizardDeliveryRecipient, WizardDeliveryRecipientAddress } from './newSaleWizardApi'
import { NEW_SALE_REVIEW_INITIAL } from './newSaleWizardState'
import { useWizardDeliveryDetails } from './useWizardDeliveryDetails'

const mocks = vi.hoisted(() => ({
  types: vi.fn(), transporters: vi.fn(), recipients: vi.fn(), createRecipient: vi.fn(), createAddress: vi.fn(),
  notify: vi.fn(), t: (key: string) => key,
}))
vi.mock('../../api/salesUkraineApi', () => ({ getSaleTransporterTypes: mocks.types, getSaleTransportersByType: mocks.transporters }))
vi.mock('./newSaleWizardApi', () => ({
  getClientDeliveryRecipients: mocks.recipients,
  newDeliveryRecipient: mocks.createRecipient,
  newDeliveryRecipientAddress: mocks.createAddress,
}))
vi.mock('../../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.t }) }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notify } }))

const recipient: WizardDeliveryRecipient = { Id: 1, NetUid: 'recipient-1', FullName: 'First', DeliveryRecipientAddresses: [{ Id: 4, Value: 'Kyiv' }] }
const sale: SalesUkraineSale = { NetUid: 'sale-1', ClientAgreement: { Client: { Id: 10 } } }
function options() {
  return {
    clientNetId: 'client-1' as string | null, sale,
    value: { ...NEW_SALE_REVIEW_INITIAL, recipient }, onChange: vi.fn(), submitFlow: 'create' as const,
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.types.mockReset().mockResolvedValue([{ NetUid: 'type-1' }])
  mocks.transporters.mockReset().mockResolvedValue([{ Id: 2, Name: 'Delivery' }])
  mocks.recipients.mockReset().mockResolvedValue([recipient])
  mocks.createRecipient.mockReset()
  mocks.createAddress.mockReset()
})
afterEach(cleanup)

describe('wizard delivery details', () => {
  it('keeps option lists and requests stable while editing unrelated form fields', async () => {
    const props = options()
    const { result, rerender } = renderHook(useWizardDeliveryDetails, { initialProps: props })
    await waitFor(() => expect(result.current.transporterOptions).toHaveLength(1))
    await waitFor(() => expect(result.current.recipientOptions).toHaveLength(1))
    const before = result.current
    rerender({ ...props, sale: { ...sale }, value: { ...props.value, comment: 'edited' } })
    expect(result.current.transporterOptions).toBe(before.transporterOptions)
    expect(result.current.recipientOptions).toBe(before.recipientOptions)
    expect(result.current.addressOptions).toBe(before.addressOptions)
    expect(mocks.types).toHaveBeenCalledOnce()
    expect(mocks.recipients).toHaveBeenCalledOnce()
  })

  it('hides old recipients immediately and ignores a response for the previous client', async () => {
    const pending = deferred<WizardDeliveryRecipient[]>()
    mocks.recipients.mockReturnValueOnce(pending.promise)
    const props = options()
    const { result, rerender } = renderHook(useWizardDeliveryDetails, { initialProps: props })
    rerender({ ...props, clientNetId: 'client-2' })
    await waitFor(() => expect(result.current.recipientOptions).toHaveLength(1))
    await act(async () => { pending.resolve([{ Id: 99, FullName: 'Old client' }]) })
    expect(result.current.recipientOptions[0].entity.Id).toBe(1)
    rerender({ ...props, clientNetId: null })
    expect(result.current.recipientOptions).toHaveLength(0)
  })

  it('seeds defaults again for another sale without reloading the same client', async () => {
    const props = { ...options(), value: { ...NEW_SALE_REVIEW_INITIAL } }
    const { rerender } = renderHook(useWizardDeliveryDetails, { initialProps: props })
    await waitFor(() => expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ recipient })))
    props.onChange.mockClear()
    rerender({ ...props, sale: { ...sale, NetUid: 'sale-2' } })
    await waitFor(() => expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ recipient })))
    expect(mocks.recipients).toHaveBeenCalledOnce()
  })

  it('does not start the dependent transporter request after unmount', async () => {
    const pending = deferred<{ NetUid: string }[]>()
    mocks.types.mockReturnValueOnce(pending.promise)
    const { unmount } = renderHook(useWizardDeliveryDetails, { initialProps: options() })
    unmount()
    await act(async () => { pending.resolve([{ NetUid: 'late-type' }]) })
    expect(mocks.transporters).not.toHaveBeenCalled()
  })

  it('serializes recipient creation and applies the result through the latest callback', async () => {
    const pending = deferred<WizardDeliveryRecipient>()
    mocks.createRecipient.mockReturnValueOnce(pending.promise)
    const props = options()
    const { result, rerender } = renderHook(useWizardDeliveryDetails, { initialProps: props })
    let request!: Promise<void>
    act(() => { request = result.current.createRecipient('New'); void result.current.createRecipient('New') })
    expect(mocks.createRecipient).toHaveBeenCalledOnce()
    const onChange = vi.fn()
    rerender({ ...props, onChange })
    await act(async () => { pending.resolve({ Id: 2, FullName: 'New' }); await request })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ recipient: { Id: 2, FullName: 'New' } }))
    expect(props.onChange).not.toHaveBeenCalled()
  })

  it.each(['client', 'unmount'] as const)('ignores recipient creation after %s changes', async (change) => {
    const pending = deferred<WizardDeliveryRecipient>()
    mocks.createRecipient.mockReturnValueOnce(pending.promise)
    const props = options()
    const { result, rerender, unmount } = renderHook(useWizardDeliveryDetails, { initialProps: props })
    let request!: Promise<void>
    act(() => { request = result.current.createRecipient('New') })
    if (change === 'unmount') unmount()
    else rerender({ ...props, clientNetId: 'client-2' })
    await act(async () => { pending.resolve({ Id: 2, FullName: 'New' }); await request })
    expect(props.onChange).not.toHaveBeenCalled()
    expect(mocks.notify).not.toHaveBeenCalled()
  })

  it('does not replace a new recipient when an old address request finishes, even after switching back', async () => {
    const pending = deferred<WizardDeliveryRecipientAddress>()
    mocks.createAddress.mockReturnValueOnce(pending.promise)
    const props = options()
    const { result, rerender } = renderHook(useWizardDeliveryDetails, { initialProps: props })
    let request!: Promise<void>
    act(() => { request = result.current.createAddress('Lviv') })
    rerender({ ...props, value: { ...props.value, recipient: { ...recipient, Id: 2 } } })
    rerender(props)
    await act(async () => { pending.resolve({ Id: 5, Value: 'Lviv' }); await request })
    expect(props.onChange).not.toHaveBeenCalled()
  })

  it('reuses an existing address and serializes new address requests', async () => {
    const pending = deferred<WizardDeliveryRecipientAddress>()
    mocks.createAddress.mockReturnValueOnce(pending.promise)
    const props = options()
    const { result } = renderHook(useWizardDeliveryDetails, { initialProps: props })
    await act(async () => { await result.current.createAddress(' KYIV ') })
    expect(props.onChange).toHaveBeenCalledWith({ address: recipient.DeliveryRecipientAddresses?.[0], addressValue: '' })
    expect(mocks.createAddress).not.toHaveBeenCalled()
    let request!: Promise<void>
    act(() => { request = result.current.createAddress('Lviv'); void result.current.createAddress('Lviv') })
    expect(mocks.createAddress).toHaveBeenCalledOnce()
    await act(async () => { pending.resolve({ Id: 5, Value: 'Lviv' }); await request })
    expect(props.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ address: { Id: 5, Value: 'Lviv' } }))
  })
})
