import type { SaleSubmitResult } from '../../api/salesUkraineApi'
import {
  classifySalesMutationFailure,
  normalizeSalesOperationNetUid,
  snapshotSalesMutationPayload,
  type SalesMutationOperationOptions,
} from '../../salesMutationOperation'
import type { SalesUkraineSale } from '../../types'
import { createWizardOperationId } from './wizardMutationOperation'

export type WizardCreateSaleSubmission = {
  operationId: string
  payload: SalesUkraineSale
}

export type WizardCreateSaleRequest = (
  sale: SalesUkraineSale,
  operation: SalesMutationOperationOptions,
) => Promise<SaleSubmitResult>

export type WizardCreateSaleAttemptResult =
  | { result: SaleSubmitResult; status: 'acknowledged' | 'reconciled' }
  | { error: unknown; status: 'pending-reconciliation' }
  | { error: unknown; status: 'definitive-failure' }

export type WizardCreateSaleSessionResult =
  | {
      result: SaleSubmitResult
      status: 'acknowledged' | 'reconciled'
      submission: null
    }
  | {
      error: unknown
      status: 'pending-reconciliation'
      submission: WizardCreateSaleSubmission
    }
  | {
      error: unknown
      status: 'definitive-failure'
      submission: null
    }

export function createWizardCreateSaleSubmission(
  payload: SalesUkraineSale,
  operationId: string = createWizardOperationId(),
): WizardCreateSaleSubmission {
  const normalizedOperationId = normalizeSalesOperationNetUid(operationId)
  const immutablePayload = snapshotSalesMutationPayload(payload, normalizedOperationId)

  return {
    operationId: normalizedOperationId,
    payload: immutablePayload,
  }
}

export function isWizardCreateSaleSubmission(value: unknown): value is WizardCreateSaleSubmission {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const submission = value as Partial<WizardCreateSaleSubmission>

  return (
    typeof submission.operationId === 'string' &&
    Boolean(submission.operationId) &&
    Boolean(submission.payload) &&
    typeof submission.payload === 'object' &&
    submission.payload.OperationNetUid === normalizeSalesOperationNetUid(submission.operationId)
  )
}

export function submitWizardCreateSale(
  submission: WizardCreateSaleSubmission,
  createSale: WizardCreateSaleRequest,
): Promise<WizardCreateSaleAttemptResult> {
  return invokeWizardCreateSale(submission, createSale, 'acknowledged')
}

export function reconcileWizardCreateSale(
  submission: WizardCreateSaleSubmission,
  createSale: WizardCreateSaleRequest,
): Promise<WizardCreateSaleAttemptResult> {
  return invokeWizardCreateSale(submission, createSale, 'reconciled')
}

export async function advanceWizardCreateSaleSession({
  createOperationId,
  createSale,
  payload,
  submission,
}: {
  createOperationId?: () => string
  createSale: WizardCreateSaleRequest
  payload?: SalesUkraineSale
  submission?: WizardCreateSaleSubmission | null
}): Promise<WizardCreateSaleSessionResult> {
  if (!submission && !payload) {
    throw new Error('A payload is required to start a create-sale operation')
  }

  const current = submission ?? createWizardCreateSaleSubmission(payload as SalesUkraineSale, createOperationId?.())

  try {
    const attempt = submission
      ? await reconcileWizardCreateSale(current, createSale)
      : await submitWizardCreateSale(current, createSale)

    if (attempt.status === 'pending-reconciliation') {
      return { ...attempt, submission: current }
    }

    return { ...attempt, submission: null }
  } catch (error) {
    if (classifySalesMutationFailure(error) === 'definitive-failure') {
      return { error, status: 'definitive-failure', submission: null }
    }

    return { error, status: 'pending-reconciliation', submission: current }
  }
}

async function invokeWizardCreateSale(
  submission: WizardCreateSaleSubmission,
  createSale: WizardCreateSaleRequest,
  successStatus: 'acknowledged' | 'reconciled',
): Promise<WizardCreateSaleAttemptResult> {
  try {
    const result = await createSale(submission.payload, { operationId: submission.operationId })

    return { result, status: successStatus }
  } catch (error) {
    return { error, status: classifySalesMutationFailure(error) }
  }
}
