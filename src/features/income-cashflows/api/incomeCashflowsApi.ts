import { apiRequest } from '../../../shared/api/apiClient'
import { IncomeCounterpartySearchType } from '../types'
import type {
  Client,
  ClientAgreement,
  ClientDebtTotal,
  Currency,
  IncomeExchangeCalculation,
  IncomeCashflowsSearchParams,
  IncomePaymentOrder,
  NamedEntity,
  Organization,
  PaymentMovement,
  PaymentRegister,
  RetailClient,
  SupplyOrganizationAgreement,
} from '../types'

export async function getIncomeCashflows(params: IncomeCashflowsSearchParams): Promise<IncomePaymentOrder[]> {
  const result = await apiRequest<unknown>('/payments/orders/income/all', {
    query: {
      currencyNetId: params.currencyNetId || undefined,
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      organizationIds: params.organizationIds?.length ? params.organizationIds : undefined,
      registerNetId: params.registerNetId || undefined,
      to: params.to,
      value: params.value || undefined,
    },
  })

  return normalizeIncomePaymentOrders(result)
}

export async function cancelIncomeCashflow(netId: string): Promise<IncomePaymentOrder | null> {
  const result = await apiRequest<unknown>('/payments/orders/income/cancel', {
    method: 'PUT',
    query: {
      netId,
    },
  })

  return normalizeCancelResult(result)
}

export async function updateIncomeCashflowClient(params: {
  clientAgreementNetId: string
  clientNetId: string
  incomeNetId: string
}): Promise<IncomePaymentOrder | null> {
  const result = await apiRequest<unknown>('/payments/orders/income/update/client', {
    method: 'PUT',
    query: {
      clientAgreementNetId: params.clientAgreementNetId,
      clientNetId: params.clientNetId,
      incomeNetId: params.incomeNetId,
    },
  })

  return normalizeCancelResult(result)
}

export async function getIncomeCashflowCurrencies(): Promise<Currency[]> {
  const result = await apiRequest<unknown>('/currencies/all')

  return readArrayPayload(result, ['Items', 'Currencies', 'Data']) as Currency[]
}

export async function getIncomeCashflowOrganizations(): Promise<Organization[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return readArrayPayload(result, ['Items', 'Organizations', 'Organisations', 'Data']) as Organization[]
}

export async function searchIncomeCashflowPaymentRegisters(value = ''): Promise<PaymentRegister[]> {
  const result = await apiRequest<unknown>('/payments/registers/search', {
    query: {
      value,
    },
  })

  return normalizePaymentRegisters(result)
}

export async function getIncomeCashflowPaymentMovements(): Promise<PaymentMovement[]> {
  const result = await apiRequest<unknown>('/payments/movements/all')

  return readArrayPayload(result, ['Items', 'PaymentMovements', 'Data']) as PaymentMovement[]
}

export async function searchIncomeCashflowPaymentMovements(value: string): Promise<PaymentMovement[]> {
  const result = await apiRequest<unknown>('/payments/movements/all/search', {
    query: {
      value,
    },
  })

  return readArrayPayload(result, ['Items', 'PaymentMovements', 'Data']) as PaymentMovement[]
}

export async function createIncomeCashflowPaymentMovement(operationName: string): Promise<PaymentMovement | null> {
  const result = await apiRequest<unknown>('/payments/movements/new', {
    method: 'POST',
    body: {
      OperationName: operationName,
    },
  })

  return result && typeof result === 'object' ? (result as PaymentMovement) : null
}

export async function searchIncomeCashflowCounterparties(
  value: string,
  type: IncomeCounterpartySearchType,
  signal?: AbortSignal,
): Promise<Client[]> {
  const searchValue = value.trim()

  if (!searchValue) {
    return []
  }

  const result = await apiRequest<unknown>('/search/by/query', {
    query: {
      filter: JSON.stringify(buildCounterpartySearchQuery(searchValue, type)),
    },
    signal,
  })

  return readArrayPayload(result, ['Items', 'Clients', 'SupplyOrganizations', 'Organizations', 'Data', 'Collection']) as Client[]
}

export async function searchIncomeCashflowClientPayers(
  value: string,
  signal?: AbortSignal,
): Promise<Client[]> {
  const searchValue = value.trim()

  if (!searchValue) {
    return []
  }

  const result = await apiRequest<unknown>('/clients/payers/search/all', {
    query: {
      limit: 20,
      offset: 0,
      value: searchValue,
    },
    signal,
  })

  return readArrayPayload(result, ['Items', 'Clients', 'Data', 'Collection']) as Client[]
}

export async function getIncomeCashflowClientAgreements(netId: string): Promise<ClientAgreement[]> {
  const result = await apiRequest<unknown>('/agreements/client/all', {
    query: {
      netId,
    },
  })

  return readArrayPayload(result, ['Items', 'ClientAgreements', 'Agreements', 'Data', 'Collection']) as ClientAgreement[]
}

export async function getIncomeCashflowSupplyOrganizationAgreements(id: number): Promise<SupplyOrganizationAgreement[]> {
  const result = await apiRequest<unknown>('/supplies/organizations/agreements/by', {
    query: {
      id,
    },
  })

  return readArrayPayload(result, ['Items', 'SupplyOrganizationAgreements', 'Agreements', 'Data', 'Collection']) as SupplyOrganizationAgreement[]
}

export async function getIncomeCashflowClientDebtTotal(netId: string): Promise<ClientDebtTotal | null> {
  const result = await apiRequest<unknown>('/clients/get/debt/total', {
    query: {
      netId,
    },
  })

  return result && typeof result === 'object' ? (result as ClientDebtTotal) : null
}

export async function searchIncomeCashflowUsers(value: string): Promise<NamedEntity[]> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/search', {
    query: {
      value,
    },
  })

  return readArrayPayload(result, ['Items', 'Users', 'Profiles', 'Data', 'Collection']) as NamedEntity[]
}

export async function searchIncomeCashflowRetailClients(value: string): Promise<RetailClient[]> {
  const result = await apiRequest<unknown>('/retail/clients/sales/filtered', {
    query: {
      value: value.trim(),
    },
  })

  return readArrayPayload(result, ['Items', 'RetailClients', 'Clients', 'Data', 'Collection']) as RetailClient[]
}

export async function getIncomeCashflowRetailClientAgreements(netId: string): Promise<ClientAgreement[]> {
  const result = await apiRequest<unknown>('/agreements/retail/client/all', {
    query: {
      netId,
    },
  })

  return readArrayPayload(result, ['Items', 'ClientAgreements', 'Agreements', 'Data', 'Collection']) as ClientAgreement[]
}

export async function getIncomeCashflowSpecificExchangeRate(params: {
  fromCurrencyNetId: string
  fromDate: string
  toCurrencyNetId: string
}): Promise<number> {
  const result = await apiRequest<unknown>('/exchangerates/get/specific', {
    query: {
      fromCurrencyNetId: params.fromCurrencyNetId,
      fromDate: params.fromDate,
      toCurrencyNetId: params.toCurrencyNetId,
    },
  })

  return readNumberPayload(result)
}

export async function getCurrentEuroExchangeRate(): Promise<number> {
  const result = await apiRequest<unknown>('/exchangerates/get/current')
  const rates = Array.isArray(result) ? (result as Array<Record<string, unknown>>) : []
  const euro = rates.find((rate) => rate.Code === 'EUR')

  return euro && typeof euro.Amount === 'number' ? euro.Amount : 0
}

export async function calculateIncomeCashflowExchange(params: {
  amount: number
  exchangeRate?: number
  fromCurrencyId?: number
  toCurrencyId?: number
}): Promise<IncomeExchangeCalculation | null> {
  const result = await apiRequest<unknown>('/payments/orders/income/exchange/calculate', {
    query: {
      amount: params.amount,
      exchangeRate: params.exchangeRate || undefined,
      fromCurrencyId: params.fromCurrencyId || undefined,
      toCurrencyId: params.toCurrencyId || undefined,
    },
  })

  return result && typeof result === 'object' ? (result as IncomeExchangeCalculation) : null
}

export async function createIncomeCashflow(order: IncomePaymentOrder, isAuto = false): Promise<IncomePaymentOrder | null> {
  const result = await apiRequest<unknown>('/payments/orders/income/new', {
    method: 'POST',
    query: {
      auto: isAuto,
    },
    body: order,
  })

  return normalizeIncomePaymentOrder(result)
}

function normalizeIncomePaymentOrders(result: unknown): IncomePaymentOrder[] {
  return readArrayPayload(result, ['Items', 'Collection', 'IncomePaymentOrders', 'Data'])
    .map(normalizeIncomePaymentOrder)
    .filter((order): order is IncomePaymentOrder => Boolean(order))
}

function normalizeIncomePaymentOrder(result: unknown): IncomePaymentOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const order = result as IncomePaymentOrder

  return {
    ...order,
    AssignedPaymentOrders: Array.isArray(order.AssignedPaymentOrders) ? order.AssignedPaymentOrders : [],
  }
}

function normalizeCancelResult(result: unknown): IncomePaymentOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const payload = result as Record<string, unknown>
  const entity = payload.Entity || payload.IncomePaymentOrder || payload.Data || result

  return normalizeIncomePaymentOrder(entity)
}

function normalizePaymentRegisters(result: unknown): PaymentRegister[] {
  return readArrayPayload(result, ['Items', 'PaymentRegisters', 'Registers', 'Data'])
    .map(normalizePaymentRegister)
    .filter((register): register is PaymentRegister => Boolean(register))
}

function normalizePaymentRegister(result: unknown): PaymentRegister | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const register = result as PaymentRegister

  return {
    ...register,
    PaymentCurrencyRegisters: Array.isArray(register.PaymentCurrencyRegisters) ? register.PaymentCurrencyRegisters : [],
  }
}

function buildCounterpartySearchQuery(value: string, type: IncomeCounterpartySearchType) {
  return {
    Table: getCounterpartySearchTable(type),
    Offset: 0,
    Limit: 20,
    BooleanFilter: '',
    Filter: JSON.stringify({
      Value: value,
      FilterItem: {
        Type: type,
        FilterOperationItem: {},
      },
    }),
    TypeRoleFilter: '',
    SortDescriptors: [],
  }
}

function getCounterpartySearchTable(type: IncomeCounterpartySearchType): string {
  if (type === IncomeCounterpartySearchType.Supplier) {
    return 'SupplyOrganization'
  }

  return 'Client'
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

function readNumberPayload(result: unknown): number {
  if (typeof result === 'number' && Number.isFinite(result)) {
    return result
  }

  if (typeof result === 'string') {
    const parsed = Number(result)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}
