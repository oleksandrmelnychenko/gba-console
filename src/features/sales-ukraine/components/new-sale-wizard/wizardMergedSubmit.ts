import {
  classifySalesMutationFailure,
  normalizeSalesOperationNetUid,
  snapshotSalesMutationPayload,
  type SalesMutationOperationOptions,
} from '../../salesMutationOperation'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../../types'
import { createWizardOperationId } from './wizardMutationOperation'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

export type WizardMergedSaleSubmission = {
  operationId: string
  payload: SalesUkraineSale
}

export type WizardMergedSaleRequest = (
  sale: SalesUkraineSale,
  operation: SalesMutationOperationOptions,
) => Promise<void>

export type WizardMergedSaleSessionResult =
  | { status: 'acknowledged' | 'reconciled'; submission: null }
  | {
      error: unknown
      status: 'pending-reconciliation'
      submission: WizardMergedSaleSubmission
    }
  | {
      error: unknown
      status: 'definitive-failure'
      submission: null
    }

export function buildWizardMergedOrderItems(items: SalesUkraineOrderItem[]): SalesUkraineOrderItem[] {
  const seen = new Set<string>()

  return items.map((item) => {
    const sourceNetUid = normalizePersistedNetUid(item.NetUid)

    if (!sourceNetUid) {
      throw new Error('Обʼєднання неможливе: позиція не має збереженого ідентифікатора')
    }

    if (seen.has(sourceNetUid)) {
      throw new Error('Обʼєднання неможливе: одна позиція передана двічі')
    }

    seen.add(sourceNetUid)

    return {
      ...item,
      NetUid: sourceNetUid,
      SourceOrderItemNetUid: sourceNetUid,
    }
  })
}

export function createWizardMergedSaleSubmission(
  payload: SalesUkraineSale,
  operationId: string = createWizardOperationId(),
): WizardMergedSaleSubmission {
  const normalizedOperationId = normalizeSalesOperationNetUid(operationId)

  return {
    operationId: normalizedOperationId,
    payload: snapshotSalesMutationPayload(payload, normalizedOperationId),
  }
}

export function isWizardMergedSaleSubmission(value: unknown): value is WizardMergedSaleSubmission {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const submission = value as Partial<WizardMergedSaleSubmission>

  return (
    typeof submission.operationId === 'string' &&
    Boolean(submission.operationId) &&
    Boolean(submission.payload) &&
    typeof submission.payload === 'object' &&
    submission.payload.OperationNetUid === normalizeSalesOperationNetUid(submission.operationId)
  )
}

export async function advanceWizardMergedSaleSession({
  createOperationId,
  payload,
  submission,
  updateMergedSale,
}: {
  createOperationId?: () => string
  payload?: SalesUkraineSale
  submission?: WizardMergedSaleSubmission | null
  updateMergedSale: WizardMergedSaleRequest
}): Promise<WizardMergedSaleSessionResult> {
  if (!submission && !payload) {
    throw new Error('A payload is required to start a merged-sale operation')
  }

  const current = submission ?? createWizardMergedSaleSubmission(payload as SalesUkraineSale, createOperationId?.())

  try {
    await updateMergedSale(current.payload, { operationId: current.operationId })

    return { status: submission ? 'reconciled' : 'acknowledged', submission: null }
  } catch (error) {
    if (classifySalesMutationFailure(error) === 'definitive-failure') {
      return { error, status: 'definitive-failure', submission: null }
    }

    return { error, status: 'pending-reconciliation', submission: current }
  }
}

function normalizePersistedNetUid(value: string | null | undefined): string {
  const netUid = value?.trim().toLowerCase() ?? ''

  return netUid === EMPTY_GUID ? '' : netUid
}
