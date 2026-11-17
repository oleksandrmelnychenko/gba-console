import { useState } from 'react'
import { getSaleReviewIssues } from '../../saleReviewGuards'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SalesUkraineSale } from '../../types'
import type { WizardDeliveryRecipient, WizardDeliveryRecipientAddress } from './newSaleWizardApi'
import { NEW_SALE_REVIEW_INITIAL, type NewSaleReviewValue } from './newSaleWizardState'
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
  it.each(['', 'old-phone'])('selects the recipient phone and address instead of retaining %s', async (oldPhone) => {
    const props = options()
    const address = { Id: 14, NetUid: 'address-14', Value: 'Lviv address', City: 'Lviv', Department: '7' }
    const selected: WizardDeliveryRecipient = { Id: 12, NetUid: 'recipient-12', FullName: 'Selected', MobilePhone: 'new-phone', DeliveryRecipientAddresses: [address] }
    const { result } = renderHook(() => {
      const [value, setValue] = useState<NewSaleReviewValue>({ ...props.value, mobilePhone: oldPhone, city: 'Old city', department: '99' })
      const details = useWizardDeliveryDetails({ ...props, value, onChange: (patch) => setValue((current) => ({ ...current, ...patch })) })
      return { ...details, value }
    })
    await waitFor(() => expect(result.current.transporterOptions).toHaveLength(1))
    act(() => result.current.selectRecipient(selected))
    expect(result.current.value).toMatchObject({ recipient: selected, recipientName: 'Selected', mobilePhone: 'new-phone', address, city: 'Lviv', department: '7' })
    const payload = { Transporter: { Id: 2 }, DeliveryRecipient: { ...result.current.value.recipient, MobilePhone: result.current.value.mobilePhone } }
    expect(getSaleReviewIssues(payload)).not.toContain('recipientPhone')
  })

  it('clears fields missing from a newly selected recipient instead of reusing another person', async () => {
    const props = options()
    const { result } = renderHook(useWizardDeliveryDetails, { initialProps: { ...props, value: { ...props.value, mobilePhone: 'old-phone', city: 'Old city', department: '99' } } })
    await waitFor(() => expect(result.current.transporterOptions).toHaveLength(1))
    const selected = { Id: 12, NetUid: 'recipient-12', FullName: 'No contact yet' }
    act(() => result.current.selectRecipient(selected))
    expect(props.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ recipient: selected, mobilePhone: '', address: null, city: '', department: '' }))
  })

  it('selects and clears address fields together while preserving the recipient phone', async () => {
    const props = options()
    const { result } = renderHook(() => {
      const [value, setValue] = useState<NewSaleReviewValue>({ ...props.value, mobilePhone: 'manual-phone', city: 'Old city', department: '99' })
      const details = useWizardDeliveryDetails({ ...props, value, onChange: (patch) => setValue((current) => ({ ...current, ...patch })) })
      return { ...details, value }
    })
    await waitFor(() => expect(result.current.transporterOptions).toHaveLength(1))
    const address = { Id: 14, NetUid: 'address-14', Value: 'Lviv address', City: 'Lviv', Department: '7' }
    act(() => result.current.selectAddress(address))
    expect(result.current.value).toMatchObject({ address, city: 'Lviv', department: '7', mobilePhone: 'manual-phone' })
    act(() => result.current.clearAddress())
    expect(result.current.value).toMatchObject({ address: null, city: '', department: '', mobilePhone: 'manual-phone' })
  })

  it('does not overwrite subsequent manual delivery edits on an unrelated rerender', async () => {
    const props = options()
    const { result, rerender } = renderHook(useWizardDeliveryDetails, { initialProps: props })
    await waitFor(() => expect(result.current.transporterOptions).toHaveLength(1))
    act(() => result.current.selectRecipient({ Id: 12, FullName: 'Selected', MobilePhone: 'stored-phone' }))
    props.onChange.mockClear()
    rerender({ ...props, value: { ...props.value, recipient: { Id: 12, FullName: 'Selected' }, mobilePhone: 'manual-phone', city: 'manual-city', department: 'manual-department' } })
    await act(async () => {})
    expect(props.onChange).not.toHaveBeenCalled()
  })

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

  it('drafts a typed recipient without any request and creates it (with phone and address) only on commit', async () => {
    const props = options()
    const { result } = renderHook(() => {
      const [value, setValue] = useState<NewSaleReviewValue>({ ...props.value, recipient: null })
      const details = useWizardDeliveryDetails({ ...props, value, onChange: (patch) => setValue((current) => ({ ...current, ...patch })) })
      return { ...details, setValue, value }
    })
    await waitFor(() => expect(result.current.recipientOptions).toHaveLength(1))

    act(() => result.current.createRecipient('  <b>New buyer</b> '))
    expect(mocks.createRecipient).not.toHaveBeenCalled()
    expect(result.current.value).toMatchObject({ isNewRecipient: true, recipient: { ClientId: 10, FullName: '<b>New buyer</b>' } })
    expect(result.current.recipientKey).toBe('recipient-draft')
    expect(result.current.recipientOptions.at(-1)?.label).toBe('<b>New buyer</b>')

    act(() => result.current.setValue((current) => ({ ...current, addressValue: 'Lviv, 1', mobilePhone: '0501112233' })))
    mocks.createRecipient.mockResolvedValueOnce({ Id: 7, FullName: '<b>New buyer</b>', MobilePhone: '0501112233' })
    mocks.createAddress.mockResolvedValueOnce({ Id: 70, Value: 'Lviv, 1' })
    let committed!: Awaited<ReturnType<typeof result.current.commitDraftRecipient>>
    await act(async () => { committed = await result.current.commitDraftRecipient() })

    expect(mocks.createRecipient).toHaveBeenCalledWith({ ClientId: 10, FullName: '<b>New buyer</b>', MobilePhone: '0501112233' })
    expect(mocks.createAddress).toHaveBeenCalledWith(expect.objectContaining({ DeliveryRecipientId: 7, Value: 'Lviv, 1' }))
    expect(committed.recipient?.Id).toBe(7)
    expect(committed.address?.Id).toBe(70)
    expect(result.current.value).toMatchObject({ isNewRecipient: false, mobilePhone: '0501112233', recipient: { Id: 7 } })
  })

  it('reuses an existing recipient with the same name instead of drafting a duplicate', async () => {
    const props = options()
    const { result } = renderHook(useWizardDeliveryDetails, { initialProps: props })
    await waitFor(() => expect(result.current.recipientOptions).toHaveLength(1))
    act(() => result.current.createRecipient('first'))
    expect(props.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ recipient, isNewRecipient: false }))
    expect(mocks.createRecipient).not.toHaveBeenCalled()
  })

  it('commit is a no-op for an already stored recipient', async () => {
    const props = options()
    const { result } = renderHook(useWizardDeliveryDetails, { initialProps: props })
    await expect(result.current.commitDraftRecipient()).resolves.toEqual({ address: null, recipient })
    expect(mocks.createRecipient).not.toHaveBeenCalled()
  })

  it('keeps the typed phone when the same recipient is picked again', async () => {
    const props = options()
    const { result } = renderHook(() => {
      const [value, setValue] = useState<NewSaleReviewValue>({ ...props.value, mobilePhone: '0509998877' })
      const details = useWizardDeliveryDetails({ ...props, value, onChange: (patch) => setValue((current) => ({ ...current, ...patch })) })
      return { ...details, value }
    })
    await waitFor(() => expect(result.current.recipientOptions).toHaveLength(1))
    act(() => result.current.selectRecipient(recipient))
    expect(result.current.value.mobilePhone).toBe('0509998877')
  })

  it('loads the stored sale comment so a delivery save does not erase it', async () => {
    const props = { ...options(), sale: { ...sale, Comment: 'QA seed sale 3 (GBA)' }, value: { ...NEW_SALE_REVIEW_INITIAL } }
    renderHook(useWizardDeliveryDetails, { initialProps: props })
    await waitFor(() => expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ comment: 'QA seed sale 3 (GBA)' })))
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
    expect(props.onChange).toHaveBeenCalledWith({ address: recipient.DeliveryRecipientAddresses?.[0], addressValue: '', city: '', department: '' })
    expect(mocks.createAddress).not.toHaveBeenCalled()
    let request!: Promise<void>
    act(() => { request = result.current.createAddress('Lviv'); void result.current.createAddress('Lviv') })
    expect(mocks.createAddress).toHaveBeenCalledOnce()
    await act(async () => { pending.resolve({ Id: 5, Value: 'Lviv' }); await request })
    expect(props.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ address: { Id: 5, Value: 'Lviv' } }))
  })
})
