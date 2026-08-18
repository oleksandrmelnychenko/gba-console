import { apiRequest } from '../../../shared/api/apiClient'
import {
  executeAccountingMutation,
  type AccountingMutationOperationOptions,
} from '../../../shared/api/accountingMutationOperation'
import type {
  BankItem,
  Currency,
  CurrencyTrader,
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
  const result = await apiRequest<unknown>('/payments/registers/accounting/all', {
    query: {
      organizationNetId: params.organizationNetId || undefined,
      type: params.type === '' ? undefined : params.type,
      value: params.value || undefined,
    },
  })

  return normalizePaymentAccountsResponse(result)
}

export async function getPaymentAccount(netId: string): Promise<PaymentAccount | null> {
  const result = await apiRequest<unknown>('/payments/registers/accounting/get', {
    query: {
      netId,
    },
  })

  return normalizePaymentAccount(result)
}

export async function createPaymentAccount(
  account: PaymentAccountPayload,
  operation?: AccountingMutationOperationOptions,
): Promise<PaymentAccount | null> {
  const result = await executeAccountingMutation({
    identity: account,
    kind: 'payment-register:add',
    operation,
    payload: account,
    request: (payload, context) => apiRequest<unknown>('/payments/registers/accounting/new', {
      body: payload,
      dedupe: false,
      headers: context.headers,
      method: 'POST',
      query: {
        operationNetUid: context.operationId,
      },
      ...(context.signal ? { signal: context.signal } : {}),
    }),
  })

  return normalizePaymentAccount(result)
}

export async function updatePaymentAccount(
  account: PaymentAccountPayload,
  operation?: AccountingMutationOperationOptions,
): Promise<PaymentAccount | null> {
  const result = await executeAccountingMutation({
    identity: account,
    kind: 'payment-register:update',
    operation,
    payload: account,
    request: (payload, context) => apiRequest<unknown>('/payments/registers/accounting/update', {
      body: payload,
      dedupe: false,
      headers: context.headers,
      method: 'POST',
      query: {
        operationNetUid: context.operationId,
      },
      ...(context.signal ? { signal: context.signal } : {}),
    }),
  })

  return normalizePaymentAccount(result)
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

export async function getPaymentAccountCurrencyTraders(paymentCurrencyRegisterNetId: string): Promise<CurrencyTrader[]> {
  const result = await apiRequest<unknown>('/currencies/traders/find/currency', {
    query: {
      netId: paymentCurrencyRegisterNetId,
    },
  })

  return readArrayPayload(result, ['Items', 'CurrencyTraders', 'Traders', 'Data', 'Collection'])
    .map(normalizeCurrencyTrader)
    .filter((trader): trader is CurrencyTrader => Boolean(trader))
}

export async function calculatePaymentAccountExchange(params: {
  amount: number
  currencyCode: string
  exchangeRate: number
}): Promise<number> {
  const result = await apiRequest<unknown>('/payments/registers/exchanges/calculate', {
    query: {
      amount: params.amount,
      currencyCode: params.currencyCode,
      exchangeRate: params.exchangeRate,
    },
  })

  if (!result || typeof result !== 'object') {
    return 0
  }

  return readNumber((result as Record<string, unknown>).Amount)
}

export async function createPaymentAccountTransfer(
  transfer: PaymentRegisterTransfer,
  operation?: AccountingMutationOperationOptions,
): Promise<PaymentRegisterTransfer | null> {
  const result = await executeAccountingMutation({
    identity: transfer,
    kind: 'payment-register:transfer',
    operation,
    payload: transfer,
    request: (payload, context) => apiRequest<unknown>('/payments/registers/transfers/new', {
      body: payload,
      dedupe: false,
      headers: context.headers,
      method: 'POST',
      query: {
        operationNetUid: context.operationId,
      },
      ...(context.signal ? { signal: context.signal } : {}),
    }),
  })

  return result && typeof result === 'object' ? result as PaymentRegisterTransfer : null
}

export async function cancelPaymentAccountTransfer(
  netId: string,
  operation?: AccountingMutationOperationOptions,
): Promise<PaymentAccountMutationResult<PaymentRegisterTransfer> | null> {
  const payload = { netId }
  const result = await executeAccountingMutation({
    identity: payload,
    kind: 'payment-register:transfer-cancel',
    operation,
    payload,
    request: (requestPayload, context) => apiRequest<unknown>('/payments/registers/transfers/cancel', {
      dedupe: false,
      headers: context.headers,
      method: 'PUT',
      query: {
        netId: requestPayload.netId,
        operationNetUid: context.operationId,
      },
      ...(context.signal ? { signal: context.signal } : {}),
    }),
  })

  return result && typeof result === 'object'
    ? result as PaymentAccountMutationResult<PaymentRegisterTransfer>
    : null
}

export async function createPaymentAccountExchange(
  exchange: PaymentRegisterCurrencyExchange,
  operation?: AccountingMutationOperationOptions,
): Promise<PaymentRegisterCurrencyExchange | null> {
  const result = await executeAccountingMutation({
    identity: exchange,
    kind: 'payment-register:currency-exchange',
    operation,
    payload: exchange,
    request: (payload, context) => apiRequest<unknown>('/payments/registers/exchanges/new', {
      body: payload,
      dedupe: false,
      headers: context.headers,
      method: 'POST',
      query: {
        operationNetUid: context.operationId,
      },
      ...(context.signal ? { signal: context.signal } : {}),
    }),
  })

  return result && typeof result === 'object' ? result as PaymentRegisterCurrencyExchange : null
}

export async function cancelPaymentAccountExchange(
  netId: string,
  operation?: AccountingMutationOperationOptions,
): Promise<PaymentAccountMutationResult<PaymentRegisterCurrencyExchange> | null> {
  const payload = { netId }
  const result = await executeAccountingMutation({
    identity: payload,
    kind: 'payment-register:currency-exchange-cancel',
    operation,
    payload,
    request: (requestPayload, context) => apiRequest<unknown>('/payments/registers/exchanges/cancel', {
      dedupe: false,
      headers: context.headers,
      method: 'PUT',
      query: {
        netId: requestPayload.netId,
        operationNetUid: context.operationId,
      },
      ...(context.signal ? { signal: context.signal } : {}),
    }),
  })

  return result && typeof result === 'object'
    ? result as PaymentAccountMutationResult<PaymentRegisterCurrencyExchange>
    : null
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

function normalizeCurrencyTrader(result: unknown): CurrencyTrader | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const trader = result as CurrencyTrader

  return {
    ...trader,
    CurrencyTraderExchangeRates: Array.isArray(trader.CurrencyTraderExchangeRates) ? trader.CurrencyTraderExchangeRates : [],
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
