import { apiRequest } from '../../../shared/api/apiClient'
import type { Transporter, TransporterType } from '../types'
import { transporterCreateOperation } from './transporterMutationOperation'

export async function getTransporterTypes(): Promise<TransporterType[]> {
  const result = await apiRequest<unknown>('/transporters/types/registry')

  return normalizeTransporterTypes(result)
}

export async function getTransportersByType(transporterTypeNetId: string): Promise<Transporter[]> {
  const result = await apiRequest<unknown>('/transporters/registry', {
    query: {
      netId: transporterTypeNetId,
    },
  })

  return normalizeTransporters(result)
}

export async function createTransporter(transporter: FormData): Promise<Transporter | null> {
  const operation = await transporterCreateOperation.prepare(transporter)

  try {
    const result = await apiRequest<unknown>('/transporters/create', {
      method: 'POST',
      body: transporter,
      headers: {
        'Idempotency-Key': operation.operationId,
      },
    })
    transporterCreateOperation.complete(operation)

    return normalizeTransporter(result)
  } catch (error) {
    transporterCreateOperation.handleFailure(operation, error)
    throw error
  }
}

export async function updateTransporter(transporter: FormData): Promise<Transporter | null> {
  const result = await apiRequest<unknown>('/transporters/edit', {
    method: 'POST',
    body: transporter,
  })

  return normalizeTransporter(result)
}

export async function archiveTransporter(netId: string): Promise<void> {
  await apiRequest<unknown>('/transporters/archive', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

function normalizeTransporterTypes(result: unknown): TransporterType[] {
  if (Array.isArray(result)) {
    return result as TransporterType[]
  }

  if (result && typeof result === 'object' && 'Items' in result && Array.isArray(result.Items)) {
    return result.Items as TransporterType[]
  }

  return []
}

function normalizeTransporter(result: unknown): Transporter | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  if ('Item' in result && result.Item && typeof result.Item === 'object') {
    return result.Item as Transporter
  }

  return result as Transporter
}

function normalizeTransporters(result: unknown): Transporter[] {
  if (Array.isArray(result)) {
    return result as Transporter[]
  }

  if (result && typeof result === 'object' && 'Items' in result && Array.isArray(result.Items)) {
    return result.Items as Transporter[]
  }

  return []
}
