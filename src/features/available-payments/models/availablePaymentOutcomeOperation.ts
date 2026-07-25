import {
  classifyAccountingMutationFailure,
  createAccountingMutationOperationId,
} from '../../../shared/api/accountingMutationOperation'
import type { AvailablePaymentOutcomeRequest } from '../types'

export type AvailablePaymentOutcomeOperation = {
  complete: (operationId: string) => void
  getOrCreate: (request: AvailablePaymentOutcomeRequest) => string
  handleFailure: (operationId: string, error: unknown) => void
  hasPending: () => boolean
}

export function createAvailablePaymentOutcomeOperation(
  createOperationId: () => string = createAccountingMutationOperationId,
): AvailablePaymentOutcomeOperation {
  let pending: {
    documents: File[]
    operationId: string
    signature: string
  } | null = null

  return {
    complete(operationId) {
      if (pending?.operationId === operationId) {
        pending = null
      }
    },
    getOrCreate(request) {
      const signature = createRequestSignature(request)

      if (pending) {
        if (
          pending.signature !== signature ||
          !sameDocuments(pending.documents, request.documents)
        ) {
          throw new Error(
            'A pending outcome-payment submission can only be retried without changes',
          )
        }

        return pending.operationId
      }

      const operationId = createOperationId()
      pending = {
        documents: [...request.documents],
        operationId,
        signature,
      }

      return operationId
    },
    handleFailure(operationId, error) {
      if (
        pending?.operationId === operationId &&
        classifyAccountingMutationFailure(error) === 'definitive-failure'
      ) {
        pending = null
      }
    },
    hasPending() {
      return pending !== null
    },
  }
}

function createRequestSignature(request: AvailablePaymentOutcomeRequest): string {
  const {
    documents,
    models,
    ...outcome
  } = request

  return stableStringify({
    documents: documents.map((document) => ({
      lastModified: document.lastModified,
      name: document.name,
      size: document.size,
      type: document.type,
    })),
    models: models.map((model) => ({
      task: model.task,
    })),
    outcome,
  })
}

function sameDocuments(left: File[], right: File[]): boolean {
  return left.length === right.length &&
    left.every((document, index) => document === right[index])
}

function stableStringify(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const properties = Object.keys(record)
      .filter((key) => typeof record[key] !== 'undefined')
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)

    return `{${properties.join(',')}}`
  }

  const serialized = JSON.stringify(value)

  if (typeof serialized !== 'string') {
    throw new Error('Outcome-payment submission contains an unsupported value')
  }

  return serialized
}
