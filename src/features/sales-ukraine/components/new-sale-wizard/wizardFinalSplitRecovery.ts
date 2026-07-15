import {
  convertVatSaleAndGetPaymentDocument,
  createSale,
  updateSaleFromData,
  type SaleSubmitResult,
} from '../../api/salesUkraineApi'
import {
  loadSalesPendingMutationByOperation,
  markSalesPendingMutationCorrupt,
  markSalesPendingMutationSubmitted,
  markSalesPendingMutationUnknown,
  resolveRejectedSalesPendingMutation,
  resolveSalesPendingMutation,
  withSalesPendingMutationLock,
  type SalesPendingMutationLease,
  type SalesPendingMutationScope,
} from '../../pendingSalesMutationRegistry'
import {
  advanceSaleFileMutationSession,
  restoreSaleFileMutationSubmission,
  resumeSaleFileMutationSubmission,
  SALE_FILE_MUTATION_SURFACES,
} from '../../saleFileMutation'
import type { SaleDocumentResult } from '../../types'
import {
  getSaleFileMutationOperationIdentity,
  isPersistedSaleFileMutationRecord,
  type PersistedSaleFileMutationRecord,
} from '../../usePersistentSaleFileMutation'
import {
  confirmWizardSplitFinalMutationCommitted,
  confirmWizardSplitFinalMutationManuallyCommitted,
  markWizardSplitFinalMutationSubmitted,
  markWizardSplitFinalMutationUnknown,
  rejectWizardSplitFinalMutation,
  stageWizardSplitFinalMutation,
  type WizardSplitFinalMutation,
  type WizardSplitRecovery,
} from './newSaleWizardState'
import {
  advanceWizardCreateSaleSession,
  isWizardCreateSaleSubmission,
  type WizardCreateSaleSubmission,
} from './wizardCreateSaleSubmit'

type PersistedFinalCreateSale = {
  flow: 'merged-split' | 'ordinary-split'
  submission: WizardCreateSaleSubmission
}

export type WizardFinalSplitRecoveryResult =
  | { status: 'not-linked' }
  | { result: SaleDocumentResult | SaleSubmitResult | null; status: 'committed' }
  | { error: unknown; status: 'pending' | 'requires-file' | 'requires-manual-confirmation' }

export async function recoverLinkedWizardFinalMutation(
  recovery: WizardSplitRecovery,
  file: File | null = null,
): Promise<WizardFinalSplitRecoveryResult> {
  const linked = recovery.finalMutation

  if (!linked) {
    return { status: 'not-linked' }
  }

  const scope = toScope(linked)
  let entry

  try {
    entry = loadSalesPendingMutationByOperation(scope, linked.operationId)
  } catch (error) {
    return { error, status: 'requires-manual-confirmation' }
  }

  if (!entry || entry.operationId !== linked.operationId) {
    return {
      error: new Error(
        `Фінальний durable-журнал операції ${linked.operationId} відсутній. ` +
        'Автоматичне повернення позицій заблоковано: спочатку звірте продаж за цим operation ID.',
      ),
      status: 'requires-manual-confirmation',
    }
  }

  try {
    return await withSalesPendingMutationLock(
      scope,
      linked.operationId,
      entry.payload,
      async (lease) => {
        linkSplitToLease(linked, lease)

        if (linked.kind === 'create-sale') {
          return recoverCreateSale(scope, lease)
        }

        return recoverFileSale(linked, scope, lease, file)
      },
    )
  } catch (error) {
    return { error, status: 'pending' }
  }
}

export async function confirmLinkedWizardFinalMutationCommitted(
  recovery: WizardSplitRecovery,
): Promise<boolean> {
  const linked = recovery.finalMutation

  if (!linked) {
    return false
  }

  const scope = toScope(linked)
  let entry

  try {
    entry = loadSalesPendingMutationByOperation(scope, linked.operationId)
  } catch {
    // The operator confirmation remains actionable even when the mutation
    // journal is corrupt. Corrupt evidence is retained and its scope stays
    // blocked; only the linked split is resolved as manually committed.
    return confirmWizardSplitFinalMutationManuallyCommitted(linked.operationId)
  }

  if (!entry) {
    return confirmWizardSplitFinalMutationManuallyCommitted(linked.operationId)
  }

  return withSalesPendingMutationLock(
    scope,
    linked.operationId,
    entry.payload,
    async (lease) => {
      linkSplitToLease(linked, lease)

      if (!confirmWizardSplitFinalMutationCommitted(linked.operationId, lease)) {
        return false
      }

      resolveSalesPendingMutation(lease, 'manual-committed')
      return true
    },
  )
}

async function recoverCreateSale(
  scope: SalesPendingMutationScope,
  lease: SalesPendingMutationLease,
): Promise<WizardFinalSplitRecoveryResult> {
  if (!isPersistedFinalCreateSale(lease.entry.payload)) {
    return invalidFinalJournal(scope, lease.operationId, 'create-sale')
  }

  markSubmitted(lease)
  const attempt = await advanceWizardCreateSaleSession({
    createSale,
    submission: lease.entry.payload.submission,
  })

  if (attempt.status === 'pending-reconciliation') {
    markUnknown(lease)
    return { error: attempt.error, status: 'pending' }
  }

  if (attempt.status === 'definitive-failure') {
    rejectWizardSplitFinalMutation(lease.operationId, lease)
    resolveRejectedSalesPendingMutation(lease)
    return { error: attempt.error, status: 'pending' }
  }

  completeFinalMutation(lease)
  return { result: attempt.result, status: 'committed' }
}

async function recoverFileSale(
  linked: WizardSplitFinalMutation,
  scope: SalesPendingMutationScope,
  lease: SalesPendingMutationLease,
  file: File | null,
): Promise<WizardFinalSplitRecoveryResult> {
  if (!isPersistedSaleFileMutationRecord(lease.entry.payload)) {
    return invalidFinalJournal(scope, lease.operationId, linked.kind)
  }

  const payload = lease.entry.payload as PersistedSaleFileMutationRecord
  const identity = getSaleFileMutationOperationIdentity(payload)

  if (
    identity?.surface !== SALE_FILE_MUTATION_SURFACES.wizard ||
    identity.intent !== 'submit' ||
    payload.kind !== linked.kind
  ) {
    return invalidFinalJournal(scope, lease.operationId, linked.kind)
  }

  let submission

  try {
    if (payload.hasFile) {
      if (!file) {
        return {
          error: new Error('Для безпечної звірки повторно оберіть той самий файл'),
          status: 'requires-file',
        }
      }

      submission = await resumeSaleFileMutationSubmission(payload, file)
    } else {
      submission = restoreSaleFileMutationSubmission(payload)
    }
  } catch (error) {
    return { error, status: 'requires-file' }
  }

  if (!submission) {
    return invalidFinalJournal(scope, lease.operationId, linked.kind)
  }

  markSubmitted(lease)
  const attempt = linked.kind === 'sale-vat-document'
    ? await advanceSaleFileMutationSession({
        kind: linked.kind,
        request: convertVatSaleAndGetPaymentDocument,
        submission,
      })
    : await advanceSaleFileMutationSession({
        kind: linked.kind,
        request: updateSaleFromData,
        submission,
      })

  if (attempt.status === 'pending-reconciliation') {
    markUnknown(lease)
    return { error: attempt.error, status: 'pending' }
  }

  if (attempt.status === 'definitive-failure') {
    rejectWizardSplitFinalMutation(lease.operationId, lease)
    resolveRejectedSalesPendingMutation(lease)
    return { error: attempt.error, status: 'pending' }
  }

  completeFinalMutation(lease)
  return { result: attempt.result, status: 'committed' }
}

function linkSplitToLease(
  linked: WizardSplitFinalMutation,
  lease: SalesPendingMutationLease,
): void {
  stageWizardSplitFinalMutation({
    context: linked.context,
    fencingToken: lease.fencingToken,
    generation: lease.generation,
    kind: linked.kind,
    operationId: linked.operationId,
    userKey: linked.userKey,
  })
}

function markSubmitted(lease: SalesPendingMutationLease): void {
  markSalesPendingMutationSubmitted(lease)
  markWizardSplitFinalMutationSubmitted(lease.operationId, lease)
}

function markUnknown(lease: SalesPendingMutationLease): void {
  markSalesPendingMutationUnknown(lease)
  markWizardSplitFinalMutationUnknown(lease.operationId, lease)
}

function completeFinalMutation(lease: SalesPendingMutationLease): void {
  if (!confirmWizardSplitFinalMutationCommitted(lease.operationId, lease)) {
    throw new Error(
      'Сервер підтвердив продаж, але durable-координація вже перейшла до іншої операції. ' +
      'Автоматичне очищення заблоковано; повторно звірте продаж за operation ID.',
    )
  }

  resolveSalesPendingMutation(lease, 'committed')
}

function invalidFinalJournal(
  scope: SalesPendingMutationScope,
  operationId: string,
  kind: string,
): WizardFinalSplitRecoveryResult {
  try {
    markSalesPendingMutationCorrupt(
      scope,
      operationId,
      `Persisted final split payload is invalid for ${kind}`,
    )
  } catch (error) {
    return { error, status: 'requires-manual-confirmation' }
  }
}

function isPersistedFinalCreateSale(value: unknown): value is PersistedFinalCreateSale {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const candidate = value as Partial<PersistedFinalCreateSale>

  return (
    (candidate.flow === 'merged-split' || candidate.flow === 'ordinary-split') &&
    isWizardCreateSaleSubmission(candidate.submission)
  )
}

function toScope(linked: WizardSplitFinalMutation): SalesPendingMutationScope {
  return {
    context: linked.context,
    kind: linked.kind,
    userKey: linked.userKey,
  }
}
