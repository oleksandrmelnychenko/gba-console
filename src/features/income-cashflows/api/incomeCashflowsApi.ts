import { apiRequest } from '../../../shared/api/apiClient'
import {
  executeAccountingMutation,
  type AccountingMutationOperationOptions,
} from '../../../shared/api/accountingMutationOperation'
import { INCOME_PAYMENT_OPERATION_CODE } from '../../accounting/accountingOperationCatalog'
import { IncomeCounterpartySearchType } from '../types'
import type {
  Client,
  ClientAgreement,
  ClientDebtTotal,
  Currency,
  IncomeExchangeCalculation,
  IncomeCashflowsSearchParams,
  IncomePaymentOrder,
  IncomePaymentOperationType,
  NamedEntity,
  Organization,
  PaymentMovement,
  PaymentRegister,
  RetailClient,
  SupplyOrganizationAgreement,
} from '../types'

const MANUFACTURER_CLIENT_TYPE_ROLE_ID = 4
const RETAIL_CLIENT_INITIAL_PAGE_SIZE = 100
const RETAIL_CLIENT_INITIAL_MAX_PAGES = 100
export async function getIncomeCashflows(params: IncomeCashflowsSearchParams): Promise<IncomePaymentOrder[]> {
  const result = await apiRequest<unknown>('/payments/orders/income/accounting/registry', {
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

export async function getIncomeCashflowByNetId(netId: string, signal?: AbortSignal): Promise<IncomePaymentOrder | null> {
  const result = await apiRequest<unknown>('/payments/orders/income/accounting/details', {
    query: {
      netId,
    },
    ...(signal ? { signal } : {}),
  })

  return normalizeIncomePaymentOrder(result)
}

export async function getIncomeCashflowForAccountingCashFlow(
  netId: string,
  signal?: AbortSignal,
): Promise<IncomePaymentOrder | null> {
  const result = await apiRequest<unknown>('/payments/orders/income/accounting-cash-flow/get', {
    query: { netId },
    ...(signal ? { signal } : {}),
  })

  return normalizeIncomePaymentOrder(result)
}

export async function cancelIncomeCashflow(
  netId: string,
  operation?: AccountingMutationOperationOptions,
): Promise<IncomePaymentOrder | null> {
  const result = await executeAccountingMutation({
    kind: 'income-payment:cancel',
    operation,
    payload: { netId },
    request: (payload, context) => apiRequest<unknown>('/payments/orders/income/accounting/cancel', {
      dedupe: false,
      headers: context.headers,
      method: 'PUT',
      query: {
        netId: payload.netId,
      },
      ...(context.signal ? { signal: context.signal } : {}),
    }),
  })

  return normalizeCancelResult(result)
}

export async function updateIncomeCashflowClient(
  params: {
    clientAgreementNetId: string
    clientNetId: string
    incomeNetId: string
  },
  operation?: AccountingMutationOperationOptions,
): Promise<IncomePaymentOrder | null> {
  const result = await executeAccountingMutation({
    identity: params,
    kind: 'income-payment:change-client',
    operation,
    payload: params,
    request: (payload, context) => apiRequest<unknown>('/payments/orders/income/accounting/reassign-client', {
      dedupe: false,
      headers: context.headers,
      method: 'PUT',
      query: {
        clientAgreementNetId: payload.clientAgreementNetId,
        clientNetId: payload.clientNetId,
        incomeNetId: payload.incomeNetId,
      },
      ...(context.signal ? { signal: context.signal } : {}),
    }),
  })

  return normalizeCancelResult(result)
}

export async function updateIncomeCashflow(
  order: IncomePaymentOrder,
  operation?: AccountingMutationOperationOptions,
): Promise<IncomePaymentOrder | null> {
  const result = await executeAccountingMutation({
    identity: order,
    kind: 'income-payment:update',
    operation,
    payload: order,
    request: (payload, context) => apiRequest<unknown>('/payments/orders/income/update', {
      body: payload,
      dedupe: false,
      headers: context.headers,
      method: 'POST',
      ...(context.signal ? { signal: context.signal } : {}),
    }),
  })

  return normalizeIncomePaymentOrder(result)
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

export async function searchIncomeCashflowRegistryPaymentRegisters(value = ''): Promise<PaymentRegister[]> {
  const result = await apiRequest<unknown>('/payments/registers/income-cashflows/registry/search', {
    query: {
      value,
    },
  })

  return normalizePaymentRegisters(result)
}

export async function getIncomeCashflowPaymentMovements(): Promise<PaymentMovement[]> {
  const result = await apiRequest<unknown>('/payments/movements/accounting/all')

  return readArrayPayload(result, ['Items', 'PaymentMovements', 'Data']) as PaymentMovement[]
}

export async function searchIncomeCashflowPaymentMovements(value: string): Promise<PaymentMovement[]> {
  const result = await apiRequest<unknown>('/payments/movements/accounting/all/search', {
    query: {
      value,
    },
  })

  return readArrayPayload(result, ['Items', 'PaymentMovements', 'Data']) as PaymentMovement[]
}

export async function createIncomeCashflowPaymentMovement(operationName: string): Promise<PaymentMovement | null> {
  const result = await apiRequest<unknown>('/payments/movements/accounting/new', {
    method: 'POST',
    body: {
      OperationName: operationName,
    },
  })

  return result && typeof result === 'object' ? (result as PaymentMovement) : null
}

export async function createIncomeCashflowPaymentMovementForAccounting(operationName: string): Promise<PaymentMovement | null> {
  const result = await apiRequest<unknown>('/payments/movements/accounting/new', {
    method: 'POST',
    body: {
      OperationName: operationName,
    },
  })

  return result && typeof result === 'object' ? (result as PaymentMovement) : null
}

export async function searchOtherIncomeCashflowCounterparties(
  value: string,
  type: IncomeCounterpartySearchType,
  signal?: AbortSignal,
): Promise<Client[]> {
  return searchIncomeCashflowCounterpartiesAt(
    value,
    type,
    getOtherIncomeCounterpartySearchPath(type),
    signal,
  )
}

export async function searchOutgoingCashflowCounterparties(
  value: string,
  type: IncomeCounterpartySearchType,
  signal?: AbortSignal,
): Promise<Client[]> {
  return searchIncomeCashflowCounterpartiesAt(
    value,
    type,
    getOutgoingCounterpartySearchPath(type),
    signal,
  )
}

async function searchIncomeCashflowCounterpartiesAt(
  value: string,
  type: IncomeCounterpartySearchType,
  path: string,
  signal?: AbortSignal,
): Promise<Client[]> {
  const searchValue = value.trim()

  if (!searchValue) {
    return []
  }

  const result = await apiRequest<unknown>(path, {
    query: getCounterpartySearchQuery(searchValue, type),
    ...(signal ? { signal } : {}),
  })

  const counterparties = readArrayPayload(
    result,
    ['Items', 'Clients', 'SupplyOrganizations', 'Organizations', 'Data', 'Collection'],
  ) as Client[]

  return type === IncomeCounterpartySearchType.Supplier
    ? counterparties
    : expandIncomeCashflowClientOptions(counterparties)
}

export async function searchIncomeCashflowCounterpartiesForOperation(
  value: string,
  type: IncomeCounterpartySearchType,
  operationType: IncomePaymentOperationType,
  signal?: AbortSignal,
): Promise<Client[]> {
  const searchValue = value.trim()

  if (!searchValue) {
    return []
  }

  const result = await apiRequest<unknown>(getIncomeCounterpartySearchPath(type, operationType), {
    query: getCounterpartySearchQuery(searchValue, type),
    ...(signal ? { signal } : {}),
  })

  const counterparties = readArrayPayload(
    result,
    ['Items', 'Clients', 'SupplyOrganizations', 'Organizations', 'Data', 'Collection'],
  ) as Client[]

  return type === IncomeCounterpartySearchType.Supplier
    ? counterparties
    : expandIncomeCashflowClientOptions(counterparties)
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

  return expandIncomeCashflowClientOptions(
    readArrayPayload(result, ['Items', 'Clients', 'Data', 'Collection']) as Client[],
  )
}

function expandIncomeCashflowClientOptions(clients: Client[]): Client[] {
  const options: Client[] = []
  const seen = new Set<string>()

  const append = (client: Client | null | undefined) => {
    if (!client) {
      return
    }

    const key = client.NetUid || (client.Id ? String(client.Id) : '')
    if (!key || seen.has(key)) {
      return
    }

    seen.add(key)
    options.push(client)
  }

  clients.forEach((client) => {
    append(client)
    client.SubClients?.forEach((link) => append(link.SubClient))
  })

  return options
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

export async function searchIncomeCashflowPaymentPurposes(params: {
  clientAgreementNetId: string
  clientNetId: string
  limit?: number
  signal?: AbortSignal
  value?: string
}): Promise<string[]> {
  const result = await apiRequest<unknown>('/payments/orders/income/payment-purpose/suggestions', {
    query: {
      clientAgreementNetId: params.clientAgreementNetId,
      clientNetId: params.clientNetId,
      limit: params.limit || 10,
      value: params.value?.trim() || undefined,
    },
    ...(params.signal ? { signal: params.signal } : {}),
  })

  const paymentPurposes = readArrayPayload(result, ['Items', 'PaymentPurposes', 'Data', 'Collection']).flatMap((item) => {
    if (typeof item !== 'string') {
      return []
    }

    const paymentPurpose = item.trim()

    return paymentPurpose ? [paymentPurpose] : []
  })

  return [...new Set(paymentPurposes)]
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

export async function getIncomeCashflowRetailClients(): Promise<RetailClient[]> {
  const clients = new Map<string, RetailClient>()
  let offset = 0

  for (let page = 0; page < RETAIL_CLIENT_INITIAL_MAX_PAGES; page += 1) {
    const result = await apiRequest<unknown>('/retail/clients/all', {
      query: {
        limit: RETAIL_CLIENT_INITIAL_PAGE_SIZE,
        offset,
      },
    })
    const nextClients = readArrayPayload(
      result,
      ['Items', 'RetailClients', 'Clients', 'Data', 'Collection'],
    ) as RetailClient[]
    const totalQty = readTotalQty(result)

    nextClients.forEach((client, index) => {
      const identity = client.NetUid
        || (client.Id ? `id:${client.Id}` : `page:${page}:row:${index}`)
      clients.set(identity, client)
    })

    offset += nextClients.length

    if (
      nextClients.length === 0
      || (totalQty !== null && offset >= totalQty)
      || (totalQty === null && nextClients.length < RETAIL_CLIENT_INITIAL_PAGE_SIZE)
    ) {
      return [...clients.values()]
    }
  }

  throw new Error('Retail-client initial lookup exceeded its safe pagination limit.')
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

export async function createIncomeCashflow(
  order: IncomePaymentOrder,
  isAuto = false,
  operation?: AccountingMutationOperationOptions,
): Promise<IncomePaymentOrder | null> {
  return createIncomeCashflowAtEndpoint(
    getIncomeCreateEndpoint(order.OperationType),
    order,
    isAuto,
    operation,
  )
}

export async function createOnlineShopIncomeCashflow(
  order: IncomePaymentOrder,
  isAuto = false,
  operation?: AccountingMutationOperationOptions,
): Promise<IncomePaymentOrder | null> {
  return createIncomeCashflowAtEndpoint('/payments/orders/income/online-shop/create', order, isAuto, operation)
}

async function createIncomeCashflowAtEndpoint(
  endpoint: string,
  order: IncomePaymentOrder,
  isAuto: boolean,
  operation?: AccountingMutationOperationOptions,
): Promise<IncomePaymentOrder | null> {
  const result = await executeAccountingMutation({
    identity: order,
    kind: 'income-payment:add',
    operation,
    payload: {
      isAuto,
      order,
    },
    request: (payload, context) => apiRequest<unknown>(endpoint, {
      body: payload.order,
      dedupe: false,
      headers: context.headers,
      method: 'POST',
      query: {
        auto: payload.isAuto,
      },
      ...(context.signal ? { signal: context.signal } : {}),
    }),
  })

  return normalizeIncomePaymentOrder(result)
}

function getIncomeCreateEndpoint(operationType: string | number | undefined): string {
  switch (Number(operationType)) {
    case INCOME_PAYMENT_OPERATION_CODE.ClientPayment:
      return '/payments/orders/income/accounting/create/client-payment'
    case INCOME_PAYMENT_OPERATION_CODE.SupplierReturn:
      return '/payments/orders/income/accounting/create/supplier-return'
    case INCOME_PAYMENT_OPERATION_CODE.OtherAccountingWithCounterparts:
      return '/payments/orders/income/accounting/create/counterparty-income'
    case INCOME_PAYMENT_OPERATION_CODE.OtherIncome:
      return '/payments/orders/income/accounting/create/other-income'
    case INCOME_PAYMENT_OPERATION_CODE.ReturnFromColleague:
      return '/payments/orders/income/accounting/create/colleague-return'
    default:
      throw new Error('Unsupported income payment operation type.')
  }
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

function getIncomeCounterpartySearchPath(
  type: IncomeCounterpartySearchType,
  operationType: IncomePaymentOperationType,
): string {
  if (operationType === INCOME_PAYMENT_OPERATION_CODE.ClientPayment) {
    if (type !== IncomeCounterpartySearchType.Client) {
      throw new Error('Client-payment search only supports client counterparties.')
    }

    return '/clients/income-cashflows/client-payment/search'
  }

  const operationSegment = operationType === INCOME_PAYMENT_OPERATION_CODE.SupplierReturn
    ? 'supplier-return'
    : operationType === INCOME_PAYMENT_OPERATION_CODE.OtherAccountingWithCounterparts
      ? 'counterparty-income'
      : null

  if (!operationSegment) {
    throw new Error('Unsupported income counterparty search operation type.')
  }

  if (type === IncomeCounterpartySearchType.Supplier) {
    return `/supplies/organizations/income-cashflows/${operationSegment}/search`
  }

  if (type === IncomeCounterpartySearchType.Manufacturer) {
    return `/clients/income-cashflows/${operationSegment}/suppliers/search`
  }

  return `/clients/income-cashflows/${operationSegment}/search`
}

function getOtherIncomeCounterpartySearchPath(type: IncomeCounterpartySearchType): string {
  if (type === IncomeCounterpartySearchType.Supplier) {
    return '/supplies/organizations/income-cashflows/other-income/search'
  }

  if (type === IncomeCounterpartySearchType.Manufacturer) {
    return '/clients/income-cashflows/other-income/suppliers/search'
  }

  return '/clients/income-cashflows/other-income/search'
}

function getOutgoingCounterpartySearchPath(type: IncomeCounterpartySearchType): string {
  if (type === IncomeCounterpartySearchType.Supplier) {
    return '/supplies/organizations/outgoing-cashflows/create/search'
  }

  if (type === IncomeCounterpartySearchType.Manufacturer) {
    return '/clients/outgoing-cashflows/create/suppliers/search'
  }

  return '/clients/outgoing-cashflows/create/search'
}

function getCounterpartySearchQuery(value: string, type: IncomeCounterpartySearchType) {
  if (type === IncomeCounterpartySearchType.Supplier) {
    return {
      limit: 20,
      offset: 0,
      value,
    }
  }

  return {
    filterSql: 'RegionCode.Value/Client.FullName',
    limit: 20,
    offset: 0,
    typeRoleFilter: type === IncomeCounterpartySearchType.Manufacturer ? String(MANUFACTURER_CLIENT_TYPE_ROLE_ID) : '',
    value,
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

function readTotalQty(result: unknown): number | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const value = (result as Record<string, unknown>).TotalQty
  const totalQty = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(totalQty) && totalQty >= 0 ? totalQty : null
}
