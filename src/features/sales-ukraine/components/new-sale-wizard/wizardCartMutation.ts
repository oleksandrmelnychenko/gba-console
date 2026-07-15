import { addOrderItem, deleteOrderItem, updateOrderItem } from '../../api/salesUkraineApi'
import {
  snapshotImmutableSalesJson,
  snapshotSalesMutationPayload,
} from '../../salesMutationOperation'
import type { SalesUkraineOrderItem } from '../../types'
import { shiftOrderItemFromSale, type WizardReservationOrderItem } from './newSaleWizardApi'
import type { WizardCartSelection } from './EditShoppingCartOverlay'
import type { WizardCartMutationExpectation } from './wizardMutationOperation'
import type { WizardSplitOrderItem } from './wizardSplitSale'

export type WizardCartMutationRequest =
  | {
      clientAgreementNetId: string
      kind: 'add'
      orderItem: SalesUkraineOrderItem
      saleNetId: string
    }
  | {
      kind: 'update'
      orderItem: SalesUkraineOrderItem
    }
  | {
      kind: 'delete'
      orderItemNetId: string
    }
  | {
      kind: 'shift'
      orderItem: SalesUkraineOrderItem | WizardReservationOrderItem
      saleFromNetId: string
      saleToNetId: string
    }

export type WizardCartLocalCommit =
  | { kind: 'none' }
  | {
      agreementNetId: string | null
      failureSplitItems?: WizardSplitOrderItem[]
      isSplit?: boolean
      kind: 'replace-split-items'
      selected?: WizardCartSelection | null
      splitItems: WizardSplitOrderItem[]
    }

export type PersistedWizardCartMutation = {
  context: string
  expectation: WizardCartMutationExpectation
  fallbackMessage: string
  localCommit: WizardCartLocalCommit
  operationId: string
  request: WizardCartMutationRequest
}

export function createPersistedWizardCartMutation(
  value: PersistedWizardCartMutation,
): PersistedWizardCartMutation {
  const request = snapshotCartRequest(value.request, value.operationId)

  return snapshotImmutableSalesJson({ ...value, request })
}

export function isPersistedWizardCartMutation(value: unknown): value is PersistedWizardCartMutation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const candidate = value as Partial<PersistedWizardCartMutation>
  const request = candidate.request as Record<string, unknown> | undefined

  if (
    typeof candidate.context !== 'string' ||
    !candidate.context ||
    typeof candidate.operationId !== 'string' ||
    !candidate.operationId ||
    typeof candidate.fallbackMessage !== 'string' ||
    !candidate.expectation ||
    typeof candidate.expectation !== 'object' ||
    !candidate.localCommit ||
    typeof candidate.localCommit !== 'object' ||
    !request ||
    typeof request.kind !== 'string' ||
    !['add', 'update', 'delete', 'shift'].includes(request.kind)
  ) {
    return false
  }

  if (request.kind === 'delete') {
    return typeof request.orderItemNetId === 'string' && Boolean(request.orderItemNetId)
  }

  if (!request.orderItem || typeof request.orderItem !== 'object') {
    return false
  }

  if (request.kind === 'update') {
    return true
  }

  if (request.kind === 'add') {
    return typeof request.clientAgreementNetId === 'string' && typeof request.saleNetId === 'string'
  }

  return typeof request.saleFromNetId === 'string' && typeof request.saleToNetId === 'string'
}

export async function executeWizardCartMutationRequest(
  request: WizardCartMutationRequest,
  operationId: string,
): Promise<void> {
  if (request.kind === 'add') {
    await addOrderItem(
      request.clientAgreementNetId,
      request.saleNetId,
      request.orderItem,
      { operationId },
    )

    return
  }

  if (request.kind === 'update') {
    await updateOrderItem(request.orderItem, { operationId })

    return
  }

  if (request.kind === 'delete') {
    await deleteOrderItem(request.orderItemNetId, { operationId })

    return
  }

  await shiftOrderItemFromSale(
    request.saleFromNetId,
    request.saleToNetId,
    request.orderItem,
    { operationId },
  )
}

function snapshotCartRequest(
  request: WizardCartMutationRequest,
  operationId: string,
): WizardCartMutationRequest {
  if (request.kind === 'delete') {
    return snapshotImmutableSalesJson(request)
  }

  if (request.kind === 'add') {
    return snapshotImmutableSalesJson({
      ...request,
      orderItem: snapshotSalesMutationPayload(request.orderItem, operationId),
    })
  }

  if (request.kind === 'update') {
    return snapshotImmutableSalesJson({
      ...request,
      orderItem: snapshotSalesMutationPayload(request.orderItem, operationId),
    })
  }

  return snapshotImmutableSalesJson({
    ...request,
    orderItem: snapshotSalesMutationPayload(request.orderItem, operationId),
  })
}
