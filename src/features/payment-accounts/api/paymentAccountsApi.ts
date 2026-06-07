import { apiRequest } from '../../../shared/api/apiClient'
import type {
  BankItem,
  Currency,
  Organization,
  PaymentAccountActivitySearchParams,
  PaymentAccount,
  PaymentAccountIncomeOrder,
  PaymentAccountOutcomeOrder,
  PaymentAccountPayload,
  PaymentAccountsResponse,
  PaymentAccountsSearchParams,
  PaymentCurrencyRegister,
  PaymentAccountMutationResult,
  PaymentMovement,
  PaymentRegisterCurrencyExchange,
  PaymentRegisterTransfer,
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

export async function getPaymentAccountsByBank(paymentRegisterNetId: string): Promise<PaymentAccount[]> {
  const result = await apiRequest<unknown>('/payments/registers/by/bank', {
    query: {
      paymentRegisterNetId,
    },
  })

  return readArrayPayload(result, ['Items', 'PaymentRegisters', 'Data']) as PaymentAccount[]
}

export async function getPaymentAccountPaymentMovements(): Promise<PaymentMovement[]> {
  const result = await apiRequest<unknown>('/payments/movements/all')

  return readArrayPayload(result, ['Items', 'PaymentMovements', 'Data']) as PaymentMovement[]
}

export async function createPaymentAccountTransfer(
  transfer: PaymentRegisterTransfer,
): Promise<PaymentRegisterTransfer | null> {
  const result = await apiRequest<unknown>('/payments/registers/transfers/new', {
    method: 'POST',
    body: transfer,
  })

  return result && typeof result === 'object' ? result as PaymentRegisterTransfer : null
}

export async function cancelPaymentAccountTransfer(netId: string): Promise<PaymentRegisterTransfer | null> {
  const result = await apiRequest<unknown>('/payments/registers/transfers/cancel', {
    method: 'PUT',
    query: {
      netId,
    },
  })

  return result && typeof result === 'object' ? result as PaymentRegisterTransfer : null
}

export async function createPaymentAccountExchange(
  exchange: PaymentRegisterCurrencyExchange,
): Promise<PaymentRegisterCurrencyExchange | null> {
  const result = await apiRequest<unknown>('/payments/registers/exchanges/new', {
    method: 'POST',
    body: exchange,
  })

  return result && typeof result === 'object' ? result as PaymentRegisterCurrencyExchange : null
}

export async function cancelPaymentAccountExchange(netId: string): Promise<PaymentAccountMutationResult | null> {
  const result = await apiRequest<unknown>('/payments/registers/exchanges/cancel', {
    method: 'PUT',
    query: {
      netId,
    },
  })

  return result && typeof result === 'object' ? result as PaymentAccountMutationResult : null
}

export async function getPaymentAccountTransfers(
  params: PaymentAccountActivitySearchParams,
): Promise<PaymentRegisterTransfer[]> {
  const result = await apiRequest<unknown>('/payments/registers/transfers/all', {
    query: {
      currencyNetId: params.currencyNetId || undefined,
      from: params.from,
      paymentRegisterNetId: params.netId,
      to: params.to,
      type: params.type,
    },
  })

  return readArrayPayload(result, ['Items', 'PaymentRegisterTransfers', 'Transfers', 'Collection', 'Data']) as PaymentRegisterTransfer[]
}

export async function getPaymentAccountExchanges(
  params: PaymentAccountActivitySearchParams,
): Promise<PaymentRegisterCurrencyExchange[]> {
  const result = await apiRequest<unknown>('/payments/registers/exchanges/all', {
    query: {
      from: params.from,
      fromCurrencyNetId: params.fromCurrencyNetId || undefined,
      paymentRegisterNetId: params.netId,
      to: params.to,
      toCurrencyNetId: params.toCurrencyNetId || undefined,
    },
  })

  return readArrayPayload(result, ['Items', 'PaymentRegisterExchanges', 'Exchanges', 'Collection', 'Data']) as PaymentRegisterCurrencyExchange[]
}

export async function getPaymentAccountCurrencyActivity(params: {
  currencyRegisterNetId: string
  from: string
  to: string
}): Promise<PaymentCurrencyRegister | null> {
  const result = await apiRequest<unknown>('/payments/registers/currencies/get/filtered', {
    query: {
      from: params.from,
      netId: params.currencyRegisterNetId,
      to: params.to,
    },
  })

  return normalizePaymentCurrencyRegister(result)
}

function normalizePaymentAccountsResponse(result: unknown): PaymentAccountsResponse {
  if (Array.isArray(result)) {
    return {
      paymentRegisters: result.reduce<PaymentAccount[]>((acc, item) => {
        const account = normalizePaymentAccount(item)
        if (isPaymentAccount(account)) {
          acc.push(account)
        }
        return acc
      }, []),
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
    paymentRegisters: rows.reduce<PaymentAccount[]>((acc, item) => {
      const account = normalizePaymentAccount(item)
      if (isPaymentAccount(account)) {
        acc.push(account)
      }
      return acc
    }, []),
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

function normalizePaymentCurrencyRegister(result: unknown): PaymentCurrencyRegister | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const register = result as PaymentCurrencyRegister
  const paymentRegister = register.PaymentRegister

  return {
    ...register,
    IncomePaymentOrders: normalizeArray<PaymentAccountIncomeOrder>(register.IncomePaymentOrders),
    OutcomePaymentOrders: normalizeArray<PaymentAccountOutcomeOrder>(register.OutcomePaymentOrders),
    PaymentRegister: paymentRegister
      ? {
          ...paymentRegister,
          IncomePaymentOrders: normalizeArray<PaymentAccountIncomeOrder>(paymentRegister.IncomePaymentOrders),
          OutcomePaymentOrders: normalizeArray<PaymentAccountOutcomeOrder>(paymentRegister.OutcomePaymentOrders),
        }
      : paymentRegister,
    PaymentRegisterCurrencyExchanges: normalizeArray<PaymentRegisterCurrencyExchange>(register.PaymentRegisterCurrencyExchanges),
    PaymentRegisterTransfers: normalizeArray<PaymentRegisterTransfer>(register.PaymentRegisterTransfers),
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

function normalizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
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
