import { apiRequest } from '../../../shared/api/apiClient'
import type {
  BankItem,
  Currency,
  Organization,
  PaymentAccount,
  PaymentAccountPayload,
  PaymentAccountsResponse,
  PaymentAccountsSearchParams,
  PaymentCurrencyRegister,
} from '../types'

export async function getPaymentAccounts(params: PaymentAccountsSearchParams = {}): Promise<PaymentAccountsResponse> {
  const result = await apiRequest<unknown>('/payments/registers/all', {
    query: {
      organizationNetId: params.organizationNetId || undefined,
      type: params.type === '' ? undefined : params.type,
      value: params.value || undefined,
    },
  })

  return normalizePaymentAccountsResponse(result)
}

export async function getPaymentAccount(netId: string): Promise<PaymentAccount | null> {
  const result = await apiRequest<unknown>('/payments/registers/get', {
    query: {
      netId,
    },
  })

  return normalizePaymentAccount(result)
}

export async function createPaymentAccount(account: PaymentAccountPayload): Promise<PaymentAccount | null> {
  const result = await apiRequest<unknown>('/payments/registers/new', {
    method: 'POST',
    body: account,
  })

  return normalizePaymentAccount(result)
}

export async function updatePaymentAccount(account: PaymentAccountPayload): Promise<PaymentAccount | null> {
  const result = await apiRequest<unknown>('/payments/registers/update', {
    method: 'POST',
    body: account,
  })

  return normalizePaymentAccount(result)
}

export async function deletePaymentAccount(netId: string): Promise<void> {
  await apiRequest<unknown>('/payments/registers/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function getPaymentAccountCurrencies(): Promise<Currency[]> {
  const result = await apiRequest<unknown>('/currencies/all')

  return readArrayPayload(result, ['Items', 'Currencies', 'Data']) as Currency[]
}

export async function getPaymentAccountOrganizations(): Promise<Organization[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return readArrayPayload(result, ['Items', 'Organizations', 'Organisations', 'Data']) as Organization[]
}

export async function getPaymentAccountBanks(): Promise<BankItem[]> {
  const result = await apiRequest<unknown>('/bank/all')

  return readArrayPayload(result, ['Items', 'Banks', 'Data']) as BankItem[]
}

function normalizePaymentAccountsResponse(result: unknown): PaymentAccountsResponse {
  if (Array.isArray(result)) {
    return {
      paymentRegisters: result.map(normalizePaymentAccount).filter(isPaymentAccount),
      totalEuroAmount: 0,
    }
  }

  if (!result || typeof result !== 'object') {
    return {
      paymentRegisters: [],
      totalEuroAmount: 0,
    }
  }

  const payload = result as Record<string, unknown>
  const rows = readArrayPayload(result, ['PaymentRegisters', 'Items', 'Collection', 'Data'])

  return {
    paymentRegisters: rows.map(normalizePaymentAccount).filter(isPaymentAccount),
    totalEuroAmount: readNumber(payload.TotalEuroAmount),
  }
}

function normalizePaymentAccount(result: unknown): PaymentAccount | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const account = result as PaymentAccount

  return {
    ...account,
    PaymentCurrencyRegisters: Array.isArray(account.PaymentCurrencyRegisters)
      ? account.PaymentCurrencyRegisters.filter(
          (currencyRegister): currencyRegister is PaymentCurrencyRegister =>
            Boolean(currencyRegister && typeof currencyRegister === 'object'),
        )
      : [],
  }
}

function isPaymentAccount(account: PaymentAccount | null): account is PaymentAccount {
  return Boolean(account)
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

function readNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}
