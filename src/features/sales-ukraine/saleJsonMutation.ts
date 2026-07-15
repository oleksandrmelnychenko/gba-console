import {
  classifySalesMutationFailure,
  normalizeSalesOperationNetUid,
  snapshotSalesMutationPayload,
  type SalesMutationOperationPayload,
  type SalesMutationOperationOptions,
} from './salesMutationOperation'
import type { SalesUkraineSale } from './types'
import { createWizardOperationId } from './components/new-sale-wizard/wizardMutationOperation'

export type SaleJsonMutationKind =
  | 'sale-comment'
  | 'sale-discount'
  | 'sale-recipient'
  | 'sale-recipient-address'
  | 'sale-shift-current'
  | 'sale-switch'
  | 'sale-update'

export type SaleJsonMutationSubmission<TPayload extends object = SalesUkraineSale> = {
  kind: SaleJsonMutationKind
  operationId: string
  payload: TPayload & SalesMutationOperationPayload
}

export type SaleJsonMutationRequest<TPayload extends object, TResult> = (
  payload: TPayload & SalesMutationOperationPayload,
  operation: SalesMutationOperationOptions,
) => Promise<TResult>

export type SaleJsonMutationSessionResult<TPayload extends object, TResult> =
  | { result: TResult; status: 'acknowledged' | 'replayed'; submission: null }
  | { error: unknown; status: 'pending-reconciliation'; submission: SaleJsonMutationSubmission<TPayload> }
  | { error: unknown; status: 'definitive-failure'; submission: null }

export function createSaleJsonMutationSubmission<TPayload extends object>(
  kind: SaleJsonMutationKind,
  payload: TPayload,
  operationId: string = createWizardOperationId(),
): SaleJsonMutationSubmission<TPayload> {
  const normalizedOperationId = normalizeSalesOperationNetUid(operationId)

  return {
    kind,
    operationId: normalizedOperationId,
    payload: snapshotSalesMutationPayload(payload, normalizedOperationId),
  }
}

export function isSaleJsonMutationSubmission<TPayload extends object = SalesUkraineSale>(
  value: unknown,
): value is SaleJsonMutationSubmission<TPayload> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const candidate = value as Partial<SaleJsonMutationSubmission>

  return (
    (
      candidate.kind === 'sale-discount' ||
      candidate.kind === 'sale-comment' ||
      candidate.kind === 'sale-recipient' ||
      candidate.kind === 'sale-recipient-address' ||
      candidate.kind === 'sale-shift-current' ||
      candidate.kind === 'sale-switch' ||
      candidate.kind === 'sale-update'
    ) &&
    typeof candidate.operationId === 'string' &&
    Boolean(candidate.operationId) &&
    Boolean(candidate.payload) &&
    typeof candidate.payload === 'object' &&
    candidate.payload.OperationNetUid === candidate.operationId
  )
}

export function hasSameSaleJsonMutationPayload<TPayload extends object>(
  submission: SaleJsonMutationSubmission<TPayload>,
  payload: TPayload,
): boolean {
  const candidate = snapshotSalesMutationPayload(payload, submission.operationId)

  return stableJson(candidate) === stableJson(submission.payload)
}

export async function advanceSaleJsonMutationSession<TPayload extends object, TResult>({
  request,
  submission,
  wasPending = false,
}: {
  request: SaleJsonMutationRequest<TPayload, TResult>
  submission: SaleJsonMutationSubmission<TPayload>
  wasPending?: boolean
}): Promise<SaleJsonMutationSessionResult<TPayload, TResult>> {
  try {
    const result = await request(submission.payload, { operationId: submission.operationId })

    return {
      result,
      status: wasPending ? 'replayed' : 'acknowledged',
      submission: null,
    }
  } catch (error) {
    if (classifySalesMutationFailure(error) === 'definitive-failure') {
      return { error, status: 'definitive-failure', submission: null }
    }

    return { error, status: 'pending-reconciliation', submission }
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)

    return `{${entries.join(',')}}`
  }

  return JSON.stringify(value) ?? 'undefined'
}
