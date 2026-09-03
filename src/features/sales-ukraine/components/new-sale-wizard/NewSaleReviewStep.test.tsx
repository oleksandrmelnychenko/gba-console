import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../../shared/api/apiClient'
import { theme } from '../../../../shared/theme/theme'
import {
  clearAllSalesPendingMutations,
  loadSalesPendingMutation,
  saveSalesPendingMutation,
  type SalesPendingMutationScope,
} from '../../pendingSalesMutationRegistry'
import {
  createSaleFileMutationSubmission,
  getLegacySaleFileMutationContext,
  getSaleFileMutationContext,
  persistSaleFileMutationSubmission,
  SALE_FILE_MUTATION_SURFACES,
} from '../../saleFileMutation'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../../types'
import { persistSaleFileMutationRecord } from '../../usePersistentSaleFileMutation'
import type { NewSaleReviewValue } from './newSaleWizardState'
import { NewSaleReviewStep } from './NewSaleReviewStep'
import { createWizardSplitOrderItem } from './wizardSplitSale'

const mocks = vi.hoisted(() => ({
  clearWizardMergedSale: vi.fn(),
  clearWizardSplitFinalMutation: vi.fn(),
  clearWizardSplitOrderItems: vi.fn(),
  confirmWizardSplitFinalMutationCommitted: vi.fn(),
  convertVatSaleAndGetPaymentDocument: vi.fn(),
  createSale: vi.fn(),
  createSalesUkraineMergedSale: vi.fn(),
  createSalesUkraineSaleFromData: vi.fn(),
  createSalesUkraineVatSaleAndGetPaymentDocument: vi.fn(),
  getClientDeliveryRecipients: vi.fn(),
  getRetailPaymentStatusBySaleId: vi.fn(),
  getSaleTransporterTypes: vi.fn(),
  getSaleTransportersByType: vi.fn(),
  keyHandler: null as ((event: { hotkey: string }) => boolean) | null,
  markWizardSplitFinalMutationSubmitted: vi.fn(),
  markWizardSplitFinalMutationUnknown: vi.fn(),
  mergedSale: null as {
    netUid: string
    orderItems: SalesUkraineOrderItem[]
    unionSale: SalesUkraineSale | null
  } | null,
  newDeliveryRecipient: vi.fn(),
  newDeliveryRecipientAddress: vi.fn(),
  notificationsShow: vi.fn(),
  reviewComboboxProps: {} as Record<string, {
    draftValue?: string
    onDraftChange?: (input: string) => void
    onFreeText?: (input: string) => void
  }>,
  splitItems: [] as ReturnType<typeof createWizardSplitOrderItem>[],
  splitRecovery: null as { agreementNetId: string } | null,
  rejectWizardSplitFinalMutation: vi.fn(),
  stageWizardSplitFinalMutation: vi.fn(),
  translate: (key: string) => key,
  updateMergedSale: vi.fn(),
  updateSaleFromData: vi.fn(),
}))

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ session: { userNetUid: 'USER-A' } }),
}))

vi.mock('../../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: mocks.translate }),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mocks.notificationsShow },
}))

vi.mock('../../api/salesUkraineApi', () => ({
  convertVatSaleAndGetPaymentDocument: mocks.convertVatSaleAndGetPaymentDocument,
  createSale: mocks.createSale,
  createSalesUkraineMergedSale: mocks.createSalesUkraineMergedSale,
  createSalesUkraineSaleFromData: mocks.createSalesUkraineSaleFromData,
  createSalesUkraineVatSaleAndGetPaymentDocument: mocks.createSalesUkraineVatSaleAndGetPaymentDocument,
  getRetailPaymentStatusBySaleId: mocks.getRetailPaymentStatusBySaleId,
  getSaleTransporterTypes: mocks.getSaleTransporterTypes,
  getSaleTransportersByType: mocks.getSaleTransportersByType,
  updateMergedSale: mocks.updateMergedSale,
  updateSaleFromData: mocks.updateSaleFromData,
}))

vi.mock('./newSaleWizardApi', () => ({
  getClientDeliveryRecipients: mocks.getClientDeliveryRecipients,
  newDeliveryRecipient: mocks.newDeliveryRecipient,
  newDeliveryRecipientAddress: mocks.newDeliveryRecipientAddress,
}))

vi.mock('./newSaleWizardState', () => ({
  clearWizardMergedSale: mocks.clearWizardMergedSale,
  clearWizardSplitFinalMutation: mocks.clearWizardSplitFinalMutation,
  clearWizardSplitOrderItems: mocks.clearWizardSplitOrderItems,
  confirmWizardSplitFinalMutationCommitted: mocks.confirmWizardSplitFinalMutationCommitted,
  getWizardSplitRecovery: () => mocks.splitRecovery,
  isSelfCheckout: () => false,
  markWizardSplitFinalMutationSubmitted: mocks.markWizardSplitFinalMutationSubmitted,
  markWizardSplitFinalMutationUnknown: mocks.markWizardSplitFinalMutationUnknown,
  rejectWizardSplitFinalMutation: mocks.rejectWizardSplitFinalMutation,
  stageWizardSplitFinalMutation: mocks.stageWizardSplitFinalMutation,
  useWizardMergedSale: () => mocks.mergedSale,
  useWizardSplitOrderItems: () => mocks.splitItems,
}))

vi.mock('./wizardKeyboard', () => ({
  useWizardKeyboard: () => undefined,
  useWizardKeyHandler: (handler: (event: { hotkey: string }) => boolean) => {
    mocks.keyHandler = handler
  },
}))

vi.mock('./WizardReviewCombobox', () => ({
  WizardReviewCombobox: (props: {
    draftValue?: string
    label: string
    onDraftChange?: (input: string) => void
    onFreeText?: (input: string) => void
  }) => {
    mocks.reviewComboboxProps[props.label] = props

    return <div>{props.label}</div>
  },
}))

vi.mock('./WizardReviewConfirmModal', () => ({
  WizardReviewConfirmModal: ({
    opened,
    onConfirm,
  }: {
    opened: boolean
    onConfirm: () => void
  }) => opened ? <button onClick={onConfirm}>Підтвердити закриття</button> : null,
}))

const sale: SalesUkraineSale = {
  BaseLifeCycleStatus: { SaleLifeCycleType: 0 },
  ClientAgreement: {
    Client: { NetUid: 'client-1' },
    NetUid: 'agreement-1',
  },
  Id: 10,
  NetUid: 'sale-1',
  Order: { OrderItems: [] },
}

const wizardFileScope: SalesPendingMutationScope = {
  context: getSaleFileMutationContext(sale, SALE_FILE_MUTATION_SURFACES.wizard),
  kind: 'sale-update-file',
  userKey: 'net:user-a',
}
const wizardCreateScope: SalesPendingMutationScope = {
  context: 'wizard-final:client-1:agreement-1:sale-1',
  kind: 'create-sale',
  userKey: 'net:user-a',
}
const wizardMergedScope: SalesPendingMutationScope = {
  ...wizardCreateScope,
  kind: 'merged-sale',
}
const legacyFileScope: SalesPendingMutationScope = {
  ...wizardFileScope,
  context: getLegacySaleFileMutationContext(sale),
}
const managementFileScope: SalesPendingMutationScope = {
  ...wizardFileScope,
  context: getSaleFileMutationContext(sale, SALE_FILE_MUTATION_SURFACES.management),
}
const wizardSaveOperation = {
  intent: 'save',
  surface: SALE_FILE_MUTATION_SURFACES.wizard,
} as const
const managementSaveOperation = {
  intent: 'save',
  surface: SALE_FILE_MUTATION_SURFACES.management,
} as const

function reviewValue(ttnFile: File | null = null): NewSaleReviewValue {
  return {
    address: { Id: 1 },
    addressValue: '',
    city: 'Kyiv',
    codAmount: '',
    comment: 'current form value',
    department: '1',
    hasOwnTtn: Boolean(ttnFile),
    isCashOnDelivery: false,
    isNewAddress: false,
    isNewRecipient: false,
    mobilePhone: '0500000000',
    recipient: { Id: 1 },
    recipientName: 'Recipient',
    transporter: { Id: 1 },
    ttnFile,
    ttnNumber: '',
  }
}

function renderStep({
  canConvertMergedToBill = false,
  canSubmit = true,
  onBusyChange = vi.fn(),
  onChange = vi.fn(),
  onClose = vi.fn(),
  onCreated = vi.fn(),
  onSaved = vi.fn(),
  onRequestClose = vi.fn(),
  onVatDocuments = vi.fn(),
  saleValue = sale,
  submitFlow = 'edit',
  value = reviewValue(),
}: {
  canConvertMergedToBill?: boolean
  canSubmit?: boolean
  onBusyChange?: (busy: boolean) => void
  onChange?: (patch: Partial<NewSaleReviewValue>) => void
  onClose?: () => void
  onCreated?: () => void
  onSaved?: (sale: SalesUkraineSale | null) => void
  onRequestClose?: () => void
  onVatDocuments?: (result: unknown) => void
  saleValue?: SalesUkraineSale
  submitFlow?: 'create' | 'edit'
  value?: NewSaleReviewValue
} = {}) {
  return {
    ...render(
      <MantineProvider theme={theme}>
        <NewSaleReviewStep
          canConvertMergedToBill={canConvertMergedToBill}
          canSubmit={canSubmit}
          clientNetId="client-1"
          sale={saleValue}
          value={value}
          onBusyChange={onBusyChange}
          onChange={onChange}
          onClose={onClose}
          onCreated={onCreated}
          onSaved={onSaved}
          onRequestClose={onRequestClose}
          onVatDocuments={onVatDocuments}
          submitFlow={submitFlow}
        />
      </MantineProvider>,
    ),
    onBusyChange,
    onChange,
    onClose,
    onCreated,
    onSaved,
    onRequestClose,
  }
}

describe('NewSaleReviewStep persistent file reconciliation', () => {
  beforeAll(() => {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    })
  })

  it('blocks the final submit when the current wizard flow lacks permission', () => {
    renderStep({ canSubmit: false })

    const submit = document.querySelector<HTMLButtonElement>('.new-sale-review-actions__primary')

    expect(submit?.disabled).toBe(true)
    expect(submit?.title).toBe('Недостатньо прав для завершення операції')
    expect(mocks.createSale).not.toHaveBeenCalled()
  })

  it('uses the permission-scoped multipart facade for an ordinary create submit', async () => {
    mocks.createSalesUkraineSaleFromData.mockResolvedValue({ message: 'created', sale: null })
    renderStep({ submitFlow: 'create' })

    fireEvent.click(document.querySelector<HTMLButtonElement>('.new-sale-review-actions__primary') as HTMLButtonElement)

    await waitFor(() => expect(mocks.createSalesUkraineSaleFromData).toHaveBeenCalledTimes(1))
    expect(mocks.updateSaleFromData).not.toHaveBeenCalled()
  })

  it('uses the permission-scoped VAT POST/GET facade for a create submit', async () => {
    mocks.createSalesUkraineVatSaleAndGetPaymentDocument.mockResolvedValue({
      isAcceptedToPacking: false,
      pdfUrl: 'https://example.test/payment.pdf',
    })
    renderStep({ saleValue: { ...sale, IsVatSale: true }, submitFlow: 'create' })

    fireEvent.click(document.querySelector<HTMLButtonElement>('.new-sale-review-actions__primary') as HTMLButtonElement)

    await waitFor(() => expect(mocks.createSalesUkraineVatSaleAndGetPaymentDocument).toHaveBeenCalledTimes(1))
    expect(mocks.convertVatSaleAndGetPaymentDocument).not.toHaveBeenCalled()
  })

  it('uses the permission-scoped merged facade for a create submit', async () => {
    mocks.mergedSale = {
      netUid: 'sale-1',
      orderItems: [{ NetUid: 'item-1', Product: { NetUid: 'product-1' }, Qty: 1 }],
      unionSale: null,
    }
    mocks.createSalesUkraineMergedSale.mockResolvedValue(undefined)
    renderStep({ submitFlow: 'create' })

    fireEvent.click(screen.getByRole('button', { name: 'Створити накладну' }))

    await waitFor(() => expect(mocks.createSalesUkraineMergedSale).toHaveBeenCalledTimes(1))
    expect(mocks.updateMergedSale).not.toHaveBeenCalled()
  })

  it.each(['vat', 'merged'] as const)(
    'does not enter the %s create finalizer when final create permission is denied',
    async (branch) => {
      if (branch === 'merged') {
        mocks.mergedSale = {
          netUid: 'sale-1',
          orderItems: [{ NetUid: 'item-1', Product: { NetUid: 'product-1' }, Qty: 1 }],
          unionSale: null,
        }
      }

      renderStep({
        canSubmit: false,
        saleValue: branch === 'vat' ? { ...sale, IsVatSale: true } : sale,
        submitFlow: 'create',
      })

      const submit = document.querySelector<HTMLButtonElement>('.new-sale-review-actions__primary') as HTMLButtonElement
      expect(submit.disabled).toBe(true)
      fireEvent.click(submit)

      expect(mocks.createSalesUkraineVatSaleAndGetPaymentDocument).not.toHaveBeenCalled()
      expect(mocks.createSalesUkraineMergedSale).not.toHaveBeenCalled()
      expect(mocks.createSalesUkraineSaleFromData).not.toHaveBeenCalled()
      expect(mocks.createSale).not.toHaveBeenCalled()
    },
  )

  beforeEach(() => {
    clearAllSalesPendingMutations()
    vi.clearAllMocks()
    mocks.keyHandler = null
    mocks.mergedSale = null
    mocks.reviewComboboxProps = {}
    mocks.splitItems = []
    mocks.splitRecovery = null
    mocks.getClientDeliveryRecipients.mockResolvedValue([])
    mocks.getRetailPaymentStatusBySaleId.mockResolvedValue(null)
    mocks.getSaleTransporterTypes.mockResolvedValue([])
    mocks.getSaleTransportersByType.mockResolvedValue([])
    mocks.confirmWizardSplitFinalMutationCommitted.mockReturnValue(true)
    mocks.rejectWizardSplitFinalMutation.mockReturnValue(true)
  })

  it('preserves an address draft and creates a three-character address on blur', async () => {
    const createdAddress = { Id: 2, Value: '222' }
    mocks.newDeliveryRecipientAddress.mockResolvedValue(createdAddress)
    const { onChange } = renderStep()
    const addressCombobox = mocks.reviewComboboxProps['Адреса']

    expect(addressCombobox?.draftValue).toBe('')

    act(() => addressCombobox?.onDraftChange?.('222'))
    expect(onChange).toHaveBeenCalledWith({ addressValue: '222' })

    act(() => addressCombobox?.onFreeText?.('222'))

    await waitFor(() => expect(mocks.newDeliveryRecipientAddress).toHaveBeenCalledWith({
      DeliveryRecipient: { Id: 1 },
      DeliveryRecipientId: 1,
      Value: '222',
    }))
    expect(onChange).toHaveBeenCalledWith({
      address: createdAddress,
      addressValue: '',
      recipient: { DeliveryRecipientAddresses: [createdAddress], Id: 1 },
    })
  })

  it('reconciles a legacy explicit file-backed save with the frozen body and key', async () => {
    const operationId = '11111111-1111-4111-8111-111111111111'
    const sourceFile = new File(['same bytes'], 'ttn.pdf', { lastModified: 123, type: 'application/pdf' })
    const reselectedFile = new File(['same bytes'], 'ttn.pdf', { lastModified: 123, type: 'application/pdf' })
    const submission = await createSaleFileMutationSubmission(
      'sale-update-file',
      { Comment: 'frozen save', IsEdited: true, NetUid: 'sale-1' },
      sourceFile,
      operationId,
    )
    saveSalesPendingMutation(legacyFileScope, operationId, {
      ...persistSaleFileMutationSubmission(submission),
      intent: 'save',
    })
    mocks.updateSaleFromData.mockResolvedValue({ message: 'saved' })
    const { onClose, onCreated, onSaved } = renderStep({ value: reviewValue(reselectedFile) })

    const alert = await screen.findByRole('alert')

    expect(within(alert).getByLabelText('Повторно оберіть файл для звірки')).toBeTruthy()
    fireEvent.click(within(alert).getByRole('button', { name: 'Перевірити результат' }))

    await waitFor(() => expect(mocks.updateSaleFromData).toHaveBeenCalledTimes(1))
    expect(mocks.updateSaleFromData.mock.calls[0]?.[0]).toEqual(submission.payload)
    expect(mocks.updateSaleFromData.mock.calls[0]?.[1]).toBe(reselectedFile)
    expect(mocks.updateSaleFromData.mock.calls[0]?.[2]).toEqual({ operationId })
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onCreated).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(loadSalesPendingMutation(legacyFileScope)).toBe(null)
    expect(loadSalesPendingMutation(wizardFileScope)).toBe(null)
  })

  it('saves a newly added own TTN without closing the edit wizard', async () => {
    const file = new File(['ttn'], 'carrier-ttn.pdf', { type: 'application/pdf' })
    const persistedSale = {
      ...sale,
      CustomersOwnTtn: {
        Id: 81,
        Number: 'TTN-7857',
        TtnPDFPath: '/Data/Temp/CustomersTTN-saved.pdf',
      },
      CustomersOwnTtnId: 81,
    }
    mocks.updateSaleFromData.mockResolvedValue({ message: 'saved', sale: persistedSale })
    const { onClose, onCreated, onSaved } = renderStep({
      value: {
        ...reviewValue(file),
        hasOwnTtn: true,
        ttnNumber: 'TTN-7857',
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(mocks.updateSaleFromData).toHaveBeenCalledTimes(1))
    expect(mocks.updateSaleFromData.mock.calls[0]?.[0]).toMatchObject({
      CustomersOwnTtn: { Number: 'TTN-7857' },
      IsEdited: true,
    })
    expect(mocks.updateSaleFromData.mock.calls[0]?.[1]).toBe(file)
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(persistedSale))
    expect(onCreated).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('fails closed on an intent-less legacy record instead of treating it as submit', async () => {
    const operationId = '22222222-2222-4222-8222-222222222222'
    const submission = await createSaleFileMutationSubmission(
      'sale-update-file',
      { Comment: 'generic save only', IsEdited: true, NetUid: 'sale-1' },
      null,
      operationId,
    )
    saveSalesPendingMutation(
      legacyFileScope,
      operationId,
      persistSaleFileMutationSubmission(submission),
    )
    const { onClose, onCreated } = renderStep()

    const alert = await screen.findByRole('alert')
    const submit = screen.getByRole('button', { name: 'Перевірити результат' }) as HTMLButtonElement

    expect(within(alert).getByText(/Неможливо безпечно визначити дію/)).toBeTruthy()
    expect(within(alert).queryByLabelText('Повторно оберіть файл для звірки')).toBe(null)
    expect(submit.disabled).toBe(true)
    fireEvent.click(submit)

    expect(mocks.updateSaleFromData).not.toHaveBeenCalled()
    expect(mocks.clearWizardSplitOrderItems).not.toHaveBeenCalled()
    expect(onCreated).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(loadSalesPendingMutation(legacyFileScope)?.operationId).toBe(operationId)
  })

  it('does not claim a management-surface record from the isolated wizard scope', async () => {
    const operationId = '33333333-3333-4333-8333-333333333333'
    const submission = await createSaleFileMutationSubmission(
      'sale-update-file',
      { Comment: 'management save', NetUid: 'sale-1' },
      null,
      operationId,
    )
    saveSalesPendingMutation(
      managementFileScope,
      operationId,
      persistSaleFileMutationRecord(submission, managementSaveOperation),
    )
    renderStep()

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.queryByRole('alert')).toBe(null)
    expect((screen.getByRole('button', { name: 'Створити накладну' }) as HTMLButtonElement).disabled).toBe(false)
    expect(loadSalesPendingMutation(managementFileScope)?.operationId).toBe(operationId)
  })

  it('persists a new wizard submission with explicit submit intent before sending', async () => {
    mocks.updateSaleFromData.mockRejectedValue(new ApiError('response lost', 500, null))
    const { onClose, onCreated } = renderStep()

    fireEvent.click(screen.getByRole('button', { name: 'Створити накладну' }))

    await waitFor(() => expect(loadSalesPendingMutation(wizardFileScope)?.payload).toMatchObject({
      intent: 'submit',
      surface: SALE_FILE_MUTATION_SURFACES.wizard,
    }))
    expect(onCreated).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(mocks.clearWizardSplitOrderItems).not.toHaveBeenCalled()
  })

  it('keeps the wizard closable while an ambiguous final result is pending reconciliation', async () => {
    mocks.updateSaleFromData.mockRejectedValue(new ApiError('response lost', 500, null))
    const { onBusyChange, onClose, onRequestClose } = renderStep()

    fireEvent.click(screen.getByRole('button', { name: 'Створити накладну' }))

    await screen.findByRole('button', { name: 'Перевірити результат' })
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false))

    act(() => {
      mocks.keyHandler?.({ hotkey: 'Escape' })
    })

    expect(onRequestClose).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(mocks.notificationsShow).not.toHaveBeenCalledWith(expect.objectContaining({
      message: 'Спочатку перевірте результат створення продажу',
    }))
  })

  it('links a split final operation before sending it and keeps both journals after a lost response', async () => {
    const splitItem = createWizardSplitOrderItem({
      NetUid: 'source-row-1',
      Product: { CurrentLocalPrice: 40, CurrentPrice: 10, CurrentPriceEurToUah: 40, NetUid: 'product-1' },
      Qty: 2,
      TotalAmount: 20,
      TotalAmountEurToUah: 80,
      TotalAmountLocal: 80,
    }, 1, undefined)
    mocks.splitItems = [splitItem]
    mocks.splitRecovery = { agreementNetId: 'agreement-1' }
    mocks.createSale.mockRejectedValue(new ApiError('response lost', 500, null))
    renderStep()

    fireEvent.click(screen.getByRole('button', { name: 'Створити накладну' }))

    await waitFor(() => expect(mocks.createSale).toHaveBeenCalledTimes(1))
    expect(mocks.stageWizardSplitFinalMutation).toHaveBeenCalledWith(expect.objectContaining({
      context: 'wizard-final:client-1:agreement-1:sale-1',
      kind: 'create-sale',
      operationId: expect.any(String),
      userKey: 'net:user-a',
    }))
    expect(mocks.stageWizardSplitFinalMutation.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createSale.mock.invocationCallOrder[0] as number,
    )
    expect(mocks.markWizardSplitFinalMutationSubmitted).toHaveBeenCalledWith(
      mocks.stageWizardSplitFinalMutation.mock.calls[0]?.[0].operationId,
      expect.objectContaining({
        fencingToken: expect.any(String),
        generation: expect.any(Number),
      }),
    )
    expect(mocks.markWizardSplitFinalMutationSubmitted.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createSale.mock.invocationCallOrder[0] as number,
    )
    expect(mocks.clearWizardSplitOrderItems).not.toHaveBeenCalled()
    expect(mocks.clearWizardSplitFinalMutation).not.toHaveBeenCalled()
  })

  it('settles a rejected split create and retries corrected submission with a new operation id', async () => {
    const splitItem = createWizardSplitOrderItem({
      NetUid: 'source-row-1',
      Product: { CurrentLocalPrice: 40, CurrentPrice: 10, CurrentPriceEurToUah: 40, NetUid: 'product-1' },
      Qty: 2,
      TotalAmount: 20,
      TotalAmountEurToUah: 80,
      TotalAmountLocal: 80,
    }, 1, undefined)
    mocks.splitItems = [splitItem]
    mocks.splitRecovery = { agreementNetId: 'agreement-1' }
    mocks.createSale
      .mockRejectedValueOnce(new ApiError(
        'Invalid split source',
        400,
        { MutationLedgerState: 'not-entered' },
      ))
      .mockResolvedValueOnce({ message: 'created', sale: { NetUid: 'new-sale' } })
    const { onClose, onCreated } = renderStep()
    const submit = screen.getByRole('button', { name: 'Створити накладну' })

    fireEvent.click(submit)

    await waitFor(() => expect(mocks.createSale).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(loadSalesPendingMutation(wizardCreateScope)).toBe(null))
    expect(mocks.rejectWizardSplitFinalMutation).toHaveBeenCalledWith(
      mocks.createSale.mock.calls[0]?.[1].operationId,
      expect.objectContaining({ fencingToken: expect.any(String), generation: expect.any(Number) }),
    )
    expect(mocks.markWizardSplitFinalMutationUnknown).not.toHaveBeenCalled()
    expect(onCreated).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(submit)

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mocks.createSale.mock.calls[1]?.[1].operationId).not.toBe(
      mocks.createSale.mock.calls[0]?.[1].operationId,
    )
  })

  it('settles a rejected merged sale and retries corrected data with a new operation id', async () => {
    mocks.mergedSale = {
      netUid: 'sale-1',
      orderItems: [{
        NetUid: 'item-1',
        Product: { NetUid: 'product-1' },
        Qty: 1,
      }],
      unionSale: null,
    }
    mocks.updateMergedSale
      .mockRejectedValueOnce(new ApiError(
        'Invalid merged sale',
        400,
        { MutationLedgerState: 'not-entered' },
      ))
      .mockResolvedValueOnce(undefined)
    const { onCreated } = renderStep({ canConvertMergedToBill: true })
    const submit = screen.getByRole('button', { name: 'Створити накладну' })

    fireEvent.click(submit)

    await waitFor(() => expect(mocks.updateMergedSale).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(loadSalesPendingMutation(wizardMergedScope)).toBe(null))
    expect(mocks.clearWizardMergedSale).not.toHaveBeenCalled()
    expect(mocks.notificationsShow).toHaveBeenCalledWith(expect.objectContaining({
      color: 'red',
    }))
    expect(onCreated).not.toHaveBeenCalled()

    await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(submit)

    await waitFor(() => expect(mocks.updateMergedSale).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
    expect(mocks.clearWizardMergedSale).toHaveBeenCalledTimes(1)
    expect(mocks.updateMergedSale.mock.calls[1]?.[1].operationId).not.toBe(
      mocks.updateMergedSale.mock.calls[0]?.[1].operationId,
    )
  })

  it('blocks an edit-flow merged conversion without the dedicated permission', () => {
    mocks.mergedSale = {
      netUid: 'sale-1',
      orderItems: [{ NetUid: 'item-1', Product: { NetUid: 'product-1' }, Qty: 1 }],
      unionSale: null,
    }

    renderStep()

    const submit = screen.getByRole('button', { name: 'Створити накладну' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    expect(submit.getAttribute('title')).toBe('Недостатньо прав для перетворення обʼєднаного продажу на рахунок')
    expect(mocks.updateMergedSale).not.toHaveBeenCalled()
  })

  it('does not close until close-and-save succeeds and clears its persisted operation', async () => {
    let resolveSave: ((value: { message: string }) => void) | null = null
    mocks.updateSaleFromData.mockImplementation(() => new Promise((resolve) => {
      resolveSave = resolve
    }))
    let entryAtClose: unknown = 'not-called'
    const onClose = vi.fn(() => {
      entryAtClose = loadSalesPendingMutation(wizardFileScope)
    })
    renderStep({ onClose })

    act(() => {
      mocks.keyHandler?.({ hotkey: 'Escape' })
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Підтвердити закриття' }))

    await waitFor(() => expect(mocks.updateSaleFromData).toHaveBeenCalledTimes(1))
    expect(onClose).not.toHaveBeenCalled()
    expect(loadSalesPendingMutation(wizardFileScope)?.payload).toMatchObject({
      intent: wizardSaveOperation.intent,
      surface: wizardSaveOperation.surface,
    })

    await act(async () => {
      resolveSave?.({ message: 'saved' })
    })

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(entryAtClose).toBe(null)
  })

  it.each([
    [
      { codAmount: 'not-a-number', isCashOnDelivery: true },
      'Вкажіть коректну суму наложеного платежу',
    ],
    [
      { hasOwnTtn: true, ttnNumber: '' },
      'Вкажіть номер власної ТТН',
    ],
    [
      { mobilePhone: '' },
      'Вкажіть мобільний телефон одержувача',
    ],
  ])('blocks an invalid final sale payload before creating a mutation', async (patch, message) => {
    renderStep({ value: { ...reviewValue(), ...patch } })

    fireEvent.click(screen.getByRole('button', { name: 'Створити накладну' }))

    await waitFor(() => expect(mocks.notificationsShow).toHaveBeenCalledWith({
      color: 'red',
      message,
    }))
    expect(mocks.updateSaleFromData).not.toHaveBeenCalled()
    expect(loadSalesPendingMutation(wizardFileScope)).toBe(null)
  })

  it('rejects a disallowed TTN upload before creating a mutation', async () => {
    const invalidFile = new File(['payload'], 'ttn.exe', { type: 'application/octet-stream' })

    renderStep({
      value: {
        ...reviewValue(invalidFile),
        ttnNumber: 'TTN-1',
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Створити накладну' }))

    await waitFor(() => expect(mocks.notificationsShow).toHaveBeenCalledWith({
      color: 'red',
      message: 'Файл ТТН має бути у форматі PDF, JPEG або PNG',
    }))
    expect(mocks.updateSaleFromData).not.toHaveBeenCalled()
    expect(loadSalesPendingMutation(wizardFileScope)).toBe(null)
  })
})
