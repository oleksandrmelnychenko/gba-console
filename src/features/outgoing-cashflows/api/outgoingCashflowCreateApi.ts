import { apiRequest } from '../../../shared/api/apiClient'
import type {
  CreatePaymentRegister,
  OutcomePaymentOrderCreatePayload,
  OutcomePaymentUser,
} from '../outgoingCreateTypes'
import type { Organization, OutcomePaymentOrder, PaymentMovement } from '../types'

export async function getOutgoingCreateOrganizations(): Promise<Organization[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return readArrayPayload(result, ['Items', 'Organizations', 'Organisations', 'Data']) as Organization[]
}

export async function searchOutgoingCreatePaymentRegisters(value = ''): Promise<CreatePaymentRegister[]> {
  const result = await apiRequest<unknown>('/payments/registers/search', {
    query: {
      value,
    },
  })

  return normalizePaymentRegisters(result)
}

export async function getOutgoingCreatePaymentMovements(): Promise<PaymentMovement[]> {
  const result = await apiRequest<unknown>('/payments/movements/all')

  return readArrayPayload(result, ['Items', 'PaymentMovements', 'Data']) as PaymentMovement[]
}

export async function searchOutgoingCreatePaymentMovements(value: string): Promise<PaymentMovement[]> {
  const result = await apiRequest<unknown>('/payments/movements/all/search', {
    query: {
      value,
    },
  })

  return readArrayPayload(result, ['Items', 'PaymentMovements', 'Data']) as PaymentMovement[]
}

export async function createOutgoingCreatePaymentMovement(operationName: string): Promise<PaymentMovement | null> {
  const result = await apiRequest<unknown>('/payments/movements/new', {
    method: 'POST',
    body: {
      OperationName: operationName,
    },
  })

  return result && typeof result === 'object' ? (result as PaymentMovement) : null
}

export async function searchOutgoingCreateUsers(value: string): Promise<OutcomePaymentUser[]> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/search', {
    query: {
      value,
    },
  })

  return readArrayPayload(result, ['Items', 'Users', 'Profiles', 'Data']) as OutcomePaymentUser[]
}

export async function createOutgoingCashflowOrder(
  order: OutcomePaymentOrderCreatePayload,
): Promise<OutcomePaymentOrder | null> {
  const result = await apiRequest<unknown>('/payments/orders/outcome/new', {
    method: 'POST',
    body: order,
  })

  return result && typeof result === 'object' ? (result as OutcomePaymentOrder) : null
}

function normalizePaymentRegisters(result: unknown): CreatePaymentRegister[] {
  return readArrayPayload(result, ['Items', 'PaymentRegisters', 'Registers', 'Data'])
    .map(normalizePaymentRegister)
    .filter((register): register is CreatePaymentRegister => Boolean(register))
}

function normalizePaymentRegister(result: unknown): CreatePaymentRegister | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const register = result as CreatePaymentRegister

  return {
    ...register,
    PaymentCurrencyRegisters: Array.isArray(register.PaymentCurrencyRegisters) ? register.PaymentCurrencyRegisters : [],
  }
}

function readArrayPayload(result: unknown, keys: string[]): unknown[] {
  if (Array.isArray(result)) {
    return result
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return payload[key] as unknown[]
    }
  }

  return []
}
