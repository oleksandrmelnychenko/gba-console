import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../../shared/api/apiClient'
import { convertVatSaleAndGetPaymentDocument, createSale } from '../../api/salesUkraineApi'
import {
  clearAllSalesPendingMutations,
  loadSalesPendingMutation,
  saveSalesPendingMutation,
  type SalesPendingMutationScope,
} from '../../pendingSalesMutationRegistry'
import {
  clearAllWizardSplitRecoveries,
  clearWizardSplitFinalMutation,
  claimWizardSplitRecoveryOwnership,
  getWizardSplitRecovery,
  hydrateWizardSplitRecovery,
  markWizardSplitFinalMutationSubmitted,
  setWizardSplitOrderItems,
  stageWizardSplitFinalMutation,
  WIZARD_SPLIT_RECOVERY_LEASE_MS,
} from './newSaleWizardState'
import { createWizardCreateSaleSubmission } from './wizardCreateSaleSubmit'
import {
  createSaleFileMutationSubmission,
  persistSaleFileMutationSubmission,
} from '../../saleFileMutation'
import {
  confirmLinkedWizardFinalMutationCommitted,
  recoverLinkedWizardFinalMutation,
} from './wizardFinalSplitRecovery'
import { createWizardSplitOrderItem, type WizardSplitRecoverySource } from './wizardSplitSale'
import type { WizardSaleProduct } from './wizardSaleProduct'
import {
  installSalesMutationStorageHarness,
  type SalesMutationStorageHarness,
} from '../../salesMutationStorageTestHarness'

vi.mock('../../api/salesUkraineApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/salesUkraineApi')>()

  return {
    ...actual,
    convertVatSaleAndGetPaymentDocument: vi.fn(),
    createSale: vi.fn(),
  }
})

const operationId = '11111111-1111-4111-8111-111111111111'
const source: WizardSplitRecoverySource = {
  agreementNetId: 'agreement-1',
  origin: 'ordinary',
  saleNetUid: 'source-sale-1',
  userKey: 'net:user-1',
}
const scope = {
  context: 'wizard-final:client-1:agreement-1:source-sale-1',
  kind: 'create-sale',
  userKey: source.userKey,
} satisfies SalesPendingMutationScope
const product: WizardSaleProduct = {
  CurrentLocalPrice: 40,
  CurrentPrice: 10,
  CurrentPriceEurToUah: 40,
  NetUid: 'product-1',
}

let storageHarness: SalesMutationStorageHarness

beforeEach(() => {
  storageHarness = installSalesMutationStorageHarness()
  clearAllWizardSplitRecoveries()
  clearAllSalesPendingMutations()
  vi.clearAllMocks()
  const splitItem = createWizardSplitOrderItem({
    NetUid: 'source-row-1',
    Product: product,
    Qty: 5,
    TotalAmount: 50,
    TotalAmountEurToUah: 200,
    TotalAmountLocal: 200,
  }, 2, undefined)
  setWizardSplitOrderItems([splitItem], source.agreementNetId, source)
})

afterEach(() => {
  clearAllWizardSplitRecoveries()
  clearAllSalesPendingMutations()
  storageHarness.dispose()
})

describe('linked final split recovery', () => {
  it('keeps a prepared link fail-closed when another tab cannot see a final journal yet', async () => {
    storageHarness.selectTab('tab-a')
    stageWizardSplitFinalMutation({ ...scope, operationId })
    storageHarness.selectTab('tab-b')

    const result = await recoverLinkedWizardFinalMutation(hydrateWizardSplitRecovery(source.userKey)!)

    expect(result).toMatchObject({ status: 'requires-manual-confirmation' })
    expect(getWizardSplitRecovery()?.finalMutation).toMatchObject({ operationId, phase: 'prepared' })
    expect(getWizardSplitRecovery()?.items).toHaveLength(1)
  })

  it('fails closed when a submitted link lost its final request journal', async () => {
    stageWizardSplitFinalMutation({ ...scope, operationId })
    markWizardSplitFinalMutationSubmitted(operationId)

    const result = await recoverLinkedWizardFinalMutation(getWizardSplitRecovery()!)

    expect(result).toMatchObject({ status: 'requires-manual-confirmation' })
    expect(getWizardSplitRecovery()?.finalMutation).toMatchObject({ operationId, phase: 'submitted' })
  })

  it('lets another tab reconcile the same durable operation after the owner persists it', async () => {
    const submission = createWizardCreateSaleSubmission({ NetUid: source.saleNetUid }, operationId)

    storageHarness.selectTab('tab-a')
    stageWizardSplitFinalMutation({ ...scope, operationId })
    storageHarness.selectTab('tab-b')
    expect(await recoverLinkedWizardFinalMutation(hydrateWizardSplitRecovery(source.userKey)!)).toMatchObject({
      status: 'requires-manual-confirmation',
    })

    storageHarness.selectTab('tab-a')
    saveSalesPendingMutation(scope, operationId, { flow: 'ordinary-split', submission })
    markWizardSplitFinalMutationSubmitted(operationId)
    vi.mocked(createSale).mockResolvedValue({ message: 'created once', sale: null })

    storageHarness.selectTab('tab-b')
    const hydratedRecovery = hydrateWizardSplitRecovery(source.userKey)!
    const reopenedRecovery = claimWizardSplitRecoveryOwnership(
      hydratedRecovery,
      hydratedRecovery.ownerUpdatedAt + WIZARD_SPLIT_RECOVERY_LEASE_MS,
    )!
    const result = await recoverLinkedWizardFinalMutation(reopenedRecovery)

    expect(result).toMatchObject({ status: 'committed' })
    expect(createSale).toHaveBeenCalledTimes(1)
    expect(createSale).toHaveBeenCalledWith(
      expect.objectContaining({ OperationNetUid: operationId }),
      { operationId },
    )
    expect(getWizardSplitRecovery()).toBe(null)
  })

  it('reconciles a submitted create operation after browser close and reopen', async () => {
    const submission = createWizardCreateSaleSubmission({ NetUid: source.saleNetUid }, operationId)

    stageWizardSplitFinalMutation({ ...scope, operationId })
    saveSalesPendingMutation(scope, operationId, { flow: 'ordinary-split', submission })
    markWizardSplitFinalMutationSubmitted(operationId)
    storageHarness.closeTab('tab-a')
    storageHarness.openTab('tab-reopened')
    vi.mocked(createSale).mockResolvedValue({ message: 'already created', sale: null })

    const hydratedRecovery = hydrateWizardSplitRecovery(source.userKey)!
    const recovery = claimWizardSplitRecoveryOwnership(
      hydratedRecovery,
      hydratedRecovery.ownerUpdatedAt + WIZARD_SPLIT_RECOVERY_LEASE_MS,
    )!
    const result = await recoverLinkedWizardFinalMutation(recovery)

    expect(result).toMatchObject({ status: 'committed' })
    expect(createSale).toHaveBeenCalledWith(
      expect.objectContaining({ OperationNetUid: operationId }),
      { operationId },
    )
    expect(loadSalesPendingMutation(scope)).toBe(null)
  })

  it('settles a definitive create rejection and releases the split final fence', async () => {
    const submission = createWizardCreateSaleSubmission({ NetUid: source.saleNetUid }, operationId)

    stageWizardSplitFinalMutation({ ...scope, operationId })
    saveSalesPendingMutation(scope, operationId, { flow: 'ordinary-split', submission })
    markWizardSplitFinalMutationSubmitted(operationId)
    vi.mocked(createSale).mockRejectedValue(new ApiError(
      'Invalid split source',
      400,
      { MutationLedgerState: 'not-entered' },
    ))

    const result = await recoverLinkedWizardFinalMutation(getWizardSplitRecovery()!)

    expect(result).toMatchObject({
      error: expect.any(ApiError),
      status: 'pending',
    })
    expect(loadSalesPendingMutation(scope)).toBe(null)
    expect(getWizardSplitRecovery()?.finalMutation).toBeUndefined()
    expect(getWizardSplitRecovery()?.items).toHaveLength(1)
  })

  it('supports explicit committed resolution for a submitted operation with a missing payload', async () => {
    stageWizardSplitFinalMutation({ ...scope, operationId })
    markWizardSplitFinalMutationSubmitted(operationId)
    const recovery = getWizardSplitRecovery()!

    expect(await recoverLinkedWizardFinalMutation(recovery)).toMatchObject({
      status: 'requires-manual-confirmation',
    })
    expect(await confirmLinkedWizardFinalMutationCommitted(recovery)).toBe(true)
    expect(getWizardSplitRecovery()).toBe(null)
    expect(loadSalesPendingMutation(scope)).toBe(null)
  })

  it('does not auto-link an unrelated durable operation when a prepared link is cleared', () => {
    const durableOperationId = '99999999-9999-4999-8999-999999999999'
    const submission = createWizardCreateSaleSubmission({ NetUid: source.saleNetUid }, durableOperationId)

    stageWizardSplitFinalMutation({ ...scope, operationId })
    saveSalesPendingMutation(scope, durableOperationId, { flow: 'ordinary-split', submission })

    expect(clearWizardSplitFinalMutation(operationId)).toBe(true)
    expect(getWizardSplitRecovery()?.finalMutation).toBeUndefined()
    expect(loadSalesPendingMutation(scope)?.operationId).toBe(durableOperationId)
  })

  it('clears the split journal before clearing an acknowledged final operation', async () => {
    const submission = createWizardCreateSaleSubmission({
      ClientAgreement: { NetUid: source.agreementNetId },
      NetUid: source.saleNetUid,
    }, operationId)

    stageWizardSplitFinalMutation({ ...scope, operationId })
    saveSalesPendingMutation(scope, operationId, { flow: 'ordinary-split', submission })
    vi.mocked(createSale).mockResolvedValue({ message: 'created', sale: null })

    const result = await recoverLinkedWizardFinalMutation(getWizardSplitRecovery()!)

    expect(result).toMatchObject({ status: 'committed' })
    expect(createSale).toHaveBeenCalledWith(
      expect.objectContaining({ OperationNetUid: operationId }),
      { operationId },
    )
    expect(getWizardSplitRecovery()).toBe(null)
    expect(loadSalesPendingMutation(scope)).toBe(null)
  })

  it('does not let a stale successful response clean up after split ownership takeover', async () => {
    const submission = createWizardCreateSaleSubmission({ NetUid: source.saleNetUid }, operationId)
    const requestStarted = deferred<void>()
    const releaseResponse = deferred<void>()

    storageHarness.selectTab('tab-a')
    stageWizardSplitFinalMutation({ ...scope, operationId })
    saveSalesPendingMutation(scope, operationId, { flow: 'ordinary-split', submission })
    vi.mocked(createSale).mockImplementation(async () => {
      requestStarted.resolve()
      await releaseResponse.promise
      return { message: 'previous operation committed', sale: null }
    })
    const staleAttempt = recoverLinkedWizardFinalMutation(getWizardSplitRecovery()!)
    await requestStarted.promise

    storageHarness.selectTab('tab-b')
    vi.resetModules()
    const tabBRegistry = await import('../../pendingSalesMutationRegistry')
    const tabBState = await import('./newSaleWizardState')
    const hydratedRecovery = tabBState.hydrateWizardSplitRecovery(source.userKey)!
    storageHarness.advanceClock(tabBState.WIZARD_SPLIT_RECOVERY_LEASE_MS + 1)
    expect(tabBState.claimWizardSplitRecoveryOwnership(hydratedRecovery, Date.now())).not.toBeNull()

    storageHarness.selectTab('tab-a')
    releaseResponse.resolve()
    await expect(staleAttempt).resolves.toMatchObject({
      status: 'pending',
    })
    expect(getWizardSplitRecovery()).toBeNull()

    storageHarness.selectTab('tab-b')
    expect(tabBState.hydrateWizardSplitRecovery(source.userKey)?.finalMutation?.operationId).toBe(operationId)
    expect(tabBRegistry.loadSalesPendingMutation(scope)?.operationId).toBe(operationId)
  })

  it('keeps both journals when the final response remains unknown and reconciles with the same id', async () => {
    const submission = createWizardCreateSaleSubmission({ NetUid: source.saleNetUid }, operationId)

    stageWizardSplitFinalMutation({ ...scope, operationId })
    saveSalesPendingMutation(scope, operationId, { flow: 'ordinary-split', submission })
    vi.mocked(createSale).mockRejectedValueOnce(new TypeError('network interrupted'))

    const pending = await recoverLinkedWizardFinalMutation(getWizardSplitRecovery()!)

    expect(pending).toMatchObject({ status: 'pending' })
    expect(getWizardSplitRecovery()?.finalMutation?.operationId).toBe(operationId)
    expect(loadSalesPendingMutation(scope)?.operationId).toBe(operationId)

    vi.mocked(createSale).mockResolvedValueOnce({ message: 'already created', sale: null })
    const reconciled = await recoverLinkedWizardFinalMutation(getWizardSplitRecovery()!)

    expect(reconciled).toMatchObject({ status: 'committed' })
    expect(createSale).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ OperationNetUid: operationId }),
      { operationId },
    )
    expect(getWizardSplitRecovery()).toBe(null)
  })

  it('keeps the final operation journal when clearing the split journal fails', async () => {
    const submission = createWizardCreateSaleSubmission({ NetUid: source.saleNetUid }, operationId)

    stageWizardSplitFinalMutation({ ...scope, operationId })
    saveSalesPendingMutation(scope, operationId, { flow: 'ordinary-split', submission })
    vi.mocked(createSale).mockResolvedValue({ message: 'created', sale: null })
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage)
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      if (
        key.startsWith('gba_console:wizard-split-recovery:v3:') &&
        value.includes('"recordType":"resolved"')
      ) {
        throw new DOMException('storage unavailable', 'QuotaExceededError')
      }

      return originalSetItem(key, value)
    })

    try {
      await expect(recoverLinkedWizardFinalMutation(getWizardSplitRecovery()!)).resolves.toMatchObject({
        status: 'pending',
      })
      expect(getWizardSplitRecovery()?.finalMutation?.operationId).toBe(operationId)
      expect(loadSalesPendingMutation(scope)?.operationId).toBe(operationId)
    } finally {
      setItem.mockRestore()
    }
  })

  it('requires the original file before retrying a linked VAT submission', async () => {
    const fileScope = {
      ...scope,
      kind: 'sale-vat-document',
    } satisfies SalesPendingMutationScope
    const persistedFile = {
      fileMetadata: {
        lastModified: 1,
        name: 'ttn.pdf',
        sha256: 'a'.repeat(64),
        size: 4,
        type: 'application/pdf',
      },
      hasFile: true,
      intent: 'submit' as const,
      kind: 'sale-vat-document' as const,
      operationId,
      payload: { NetUid: source.saleNetUid, OperationNetUid: operationId },
      surface: 'new-sale-wizard' as const,
    }

    stageWizardSplitFinalMutation({ ...fileScope, operationId })
    saveSalesPendingMutation(fileScope, operationId, persistedFile)

    const result = await recoverLinkedWizardFinalMutation(getWizardSplitRecovery()!)

    expect(result).toMatchObject({ status: 'requires-file' })
    expect(getWizardSplitRecovery()?.finalMutation?.operationId).toBe(operationId)
    expect(loadSalesPendingMutation(fileScope)?.operationId).toBe(operationId)
  })

  it('after browser reopen rejects a different file hash and retries with the exact file', async () => {
    const fileScope = {
      ...scope,
      kind: 'sale-vat-document',
    } satisfies SalesPendingMutationScope
    const originalFile = new File(['same'], 'ttn.pdf', {
      lastModified: 1,
      type: 'application/pdf',
    })
    const wrongFile = new File(['nope'], 'ttn.pdf', {
      lastModified: 1,
      type: 'application/pdf',
    })
    const submission = await createSaleFileMutationSubmission(
      'sale-vat-document',
      { NetUid: source.saleNetUid },
      originalFile,
      operationId,
    )
    const persisted = {
      ...persistSaleFileMutationSubmission(submission),
      intent: 'submit' as const,
      surface: 'new-sale-wizard' as const,
    }

    stageWizardSplitFinalMutation({ ...fileScope, operationId })
    saveSalesPendingMutation(fileScope, operationId, persisted)
    markWizardSplitFinalMutationSubmitted(operationId)
    storageHarness.closeTab('tab-a')
    storageHarness.openTab('tab-reopened')
    const hydratedRecovery = hydrateWizardSplitRecovery(source.userKey)!
    const recovery = claimWizardSplitRecoveryOwnership(
      hydratedRecovery,
      hydratedRecovery.ownerUpdatedAt + WIZARD_SPLIT_RECOVERY_LEASE_MS,
    )!

    expect(await recoverLinkedWizardFinalMutation(recovery, wrongFile)).toMatchObject({
      status: 'requires-file',
    })
    expect(convertVatSaleAndGetPaymentDocument).not.toHaveBeenCalled()

    vi.mocked(convertVatSaleAndGetPaymentDocument).mockResolvedValue({
      excelUrl: null,
      invoiceExcelUrl: null,
      invoicePdfUrl: null,
      isAcceptedToPacking: true,
      pdfUrl: null,
    })
    expect(await recoverLinkedWizardFinalMutation(recovery, originalFile)).toMatchObject({
      status: 'committed',
    })
    expect(convertVatSaleAndGetPaymentDocument).toHaveBeenCalledTimes(1)
    expect(loadSalesPendingMutation(fileScope)).toBe(null)
  })
})

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, reject, resolve }
}
