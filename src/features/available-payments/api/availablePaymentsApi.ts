import { apiRequest } from '../../../shared/api/apiClient'
import type {
  AvailablePaymentAccountingCashFlow,
  AvailablePaymentCurrencyRegister,
  AvailablePaymentMovement,
  AvailablePaymentOutcomeRequest,
  AvailablePaymentRegister,
  AvailablePaymentsOrganization,
  AvailablePaymentsSearchParams,
  GroupedPaymentTask,
  GroupedPaymentTaskWithTotals,
  PriceTotal,
  SupplyPaymentTask,
} from '../types'

export async function getGroupedPaymentTasks(
  params: AvailablePaymentsSearchParams,
): Promise<GroupedPaymentTaskWithTotals> {
  const query = {
    from: params.from,
    limit: params.limit,
    offset: params.offset,
    organizationNetId: params.organizationNetId,
    to: params.to,
    typePaymentTask: params.typePaymentTask,
  }
  const endpoint = params.onlyAvailableForPayment
    ? '/payments/tasks/grouped/all/available/filtered'
    : '/payments/tasks/grouped/all/filtered'

  const result = await apiRequest<unknown>(endpoint, { query })

  return normalizeGroupedPaymentTaskWithTotals(result)
}

export async function getAvailablePaymentsOrganizations(): Promise<AvailablePaymentsOrganization[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return normalizeOrganizations(result)
}

export async function searchAvailablePaymentRegisters(value = ''): Promise<AvailablePaymentRegister[]> {
  const result = await apiRequest<unknown>('/payments/registers/search', {
    query: {
      value,
    },
  })

  return normalizePaymentRegisters(result)
}

export async function getAvailablePaymentMovements(): Promise<AvailablePaymentMovement[]> {
  const result = await apiRequest<unknown>('/payments/movements/all')

  return readArrayPayload(result, ['Items', 'PaymentMovements', 'Data']) as AvailablePaymentMovement[]
}

export async function searchAvailablePaymentMovements(value: string): Promise<AvailablePaymentMovement[]> {
  const result = await apiRequest<unknown>('/payments/movements/all/search', {
    query: {
      value,
    },
  })

  return readArrayPayload(result, ['Items', 'PaymentMovements', 'Data']) as AvailablePaymentMovement[]
}

export async function getAvailablePaymentAccountingCashFlow(params: {
  from: string
  netId: string
  to: string
  typePaymentTask: number
}): Promise<AvailablePaymentAccountingCashFlow | null> {
  const result = await apiRequest<unknown>('/accounting/cashflow/get/filtered', {
    query: {
      from: params.from,
      netId: params.netId,
      to: params.to,
      typePaymentTask: params.typePaymentTask,
    },
  })

  return result && typeof result === 'object' ? (result as AvailablePaymentAccountingCashFlow) : null
}

const GOV_EXCHANGE_RATE_ORGANIZATION_NAME = 'ТОВ «АМГ «КОНКОРД»'

export async function getAvailablePaymentExchangeRate(params: {
  fromCurrencyNetId: string
  fromDate: string
  organizationName?: string
  toCurrencyNetId: string
}): Promise<number> {
  if (!params.fromCurrencyNetId || !params.toCurrencyNetId) {
    return 0
  }

  const endpoint =
    params.organizationName === GOV_EXCHANGE_RATE_ORGANIZATION_NAME
      ? '/exchangerates/gov/get/specific'
      : '/exchangerates/get/specific'

  const result = await apiRequest<unknown>(endpoint, {
    query: {
      fromCurrencyNetId: params.fromCurrencyNetId,
      fromDate: params.fromDate,
      toCurrencyNetId: params.toCurrencyNetId,
    },
  })

  return readExchangeRate(result)
}

export async function calculateAvailablePaymentConvertedAmount(params: {
  amount: number
  exchangeRate: number
  fromCurrencyId: number
  toCurrencyId: number
}): Promise<number> {
  const result = await apiRequest<unknown>('/payments/orders/income/exchange/calculate', {
    query: {
      amount: params.amount,
      exchangeRate: params.exchangeRate,
      fromCurrencyId: params.fromCurrencyId,
      toCurrencyId: params.toCurrencyId,
    },
  })

  return readConvertedAmount(result)
}

export async function getAvailablePaymentTaskByNetId(netId: string): Promise<SupplyPaymentTask | null> {
  const result = await apiRequest<unknown>('/payments/tasks/get', {
    query: {
      netId,
    },
  })

  return result && typeof result === 'object' ? (result as SupplyPaymentTask) : null
}

export async function setAvailablePaymentTaskToActive(
  task: SupplyPaymentTask,
  documents: File[],
): Promise<SupplyPaymentTask | null> {
  const formData = new FormData()
  formData.append('task', JSON.stringify(task))
  documents.forEach((document) => formData.append('documents', document))

  const result = await apiRequest<unknown>('/payments/tasks/available/set', {
    body: formData,
    method: 'POST',
  })

  return result && typeof result === 'object' ? (result as SupplyPaymentTask) : null
}

export async function createAvailablePaymentOutcome({
  amount,
  comment,
  customNumber,
  documents,
  exchangeRate,
  fromDate,
  isAccounting,
  isManagementAccounting,
  models,
  organization,
  paymentPurpose,
  selectedCurrencyRegister,
  selectedMovement,
  selectedRegister,
}: AvailablePaymentOutcomeRequest): Promise<unknown> {
  const firstModel = models[0]

  if (!firstModel) {
    throw new Error('Available payment outcome payload is incomplete')
  }

  const formData = new FormData()
  formData.append(
    'order',
    JSON.stringify({
      Amount: amount,
      Comment: comment,
      CustomNumber: customNumber,
      ExchangeRate: exchangeRate > 0 ? exchangeRate : 0,
      FromDate: fromDate,
      IsAccounting: isAccounting,
      IsManagementAccounting: isManagementAccounting,
      IsUnderReport: false,
      Organization: organization,
      OutcomePaymentOrderSupplyPaymentTasks: models.map((model) => ({
        SupplyPaymentTask: model.task,
      })),
      PaymentCurrencyRegister: selectedCurrencyRegister,
      PaymentMovementOperation: {
        PaymentMovement: selectedMovement,
      },
      PaymentPurpose: paymentPurpose,
      PaymentRegister: selectedRegister,
    }),
  )
  documents.forEach((document) => formData.append('documents', document))

  return apiRequest<unknown>('/payments/orders/outcome/new/supplies', {
    body: formData,
    method: 'POST',
  })
}

function normalizeGroupedPaymentTaskWithTotals(result: unknown): GroupedPaymentTaskWithTotals {
  if (!result || typeof result !== 'object') {
    return { GroupedPaymentTasks: [], PriceTotals: [], TotalGrossPrice: 0 }
  }

  const payload = result as Record<string, unknown>

  return {
    GroupedPaymentTasks: normalizeGroupedPaymentTasks(payload.GroupedPaymentTasks),
    PriceTotals: normalizePriceTotals(payload.PriceTotals),
    TotalGrossPrice: typeof payload.TotalGrossPrice === 'number' ? payload.TotalGrossPrice : 0,
  }
}

function normalizeGroupedPaymentTasks(value: unknown): GroupedPaymentTask[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((task) => {
    const group = task as GroupedPaymentTask

    return {
      ...group,
      PriceTotals: normalizePriceTotals(group.PriceTotals),
      SupplyPaymentTasks: Array.isArray(group.SupplyPaymentTasks) ? group.SupplyPaymentTasks : [],
    }
  })
}

function normalizePriceTotals(value: unknown): PriceTotal[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value as PriceTotal[]
}

function normalizeOrganizations(result: unknown): AvailablePaymentsOrganization[] {
  if (Array.isArray(result)) {
    return result as AvailablePaymentsOrganization[]
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>
  const items = Array.isArray(payload.Organisations)
    ? payload.Organisations
    : Array.isArray(payload.Organizations)
      ? payload.Organizations
      : Array.isArray(payload.Items)
        ? payload.Items
        : []

  return items as AvailablePaymentsOrganization[]
}

function normalizePaymentRegisters(result: unknown): AvailablePaymentRegister[] {
  return readArrayPayload(result, ['Items', 'PaymentRegisters', 'Registers', 'Data'])
    .map(normalizePaymentRegister)
    .filter((register): register is AvailablePaymentRegister => Boolean(register))
}

function normalizePaymentRegister(result: unknown): AvailablePaymentRegister | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const register = result as AvailablePaymentRegister

  return {
    ...register,
    PaymentCurrencyRegisters: Array.isArray(register.PaymentCurrencyRegisters)
      ? register.PaymentCurrencyRegisters.map(normalizeCurrencyRegister)
      : [],
  }
}

function normalizeCurrencyRegister(result: unknown): AvailablePaymentCurrencyRegister {
  return result && typeof result === 'object' ? (result as AvailablePaymentCurrencyRegister) : {}
}

function readExchangeRate(result: unknown): number {
  if (typeof result === 'number') {
    return Number.isFinite(result) ? result : 0
  }

  if (!result || typeof result !== 'object') {
    return 0
  }

  const payload = result as Record<string, unknown>

  for (const key of ['Rate', 'ExchangeRate', 'Value', 'Cross']) {
    const value = payload[key]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }

  return 0
}

function readConvertedAmount(result: unknown): number {
  if (typeof result === 'number') {
    return Number.isFinite(result) ? result : 0
  }

  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>
    const body = record.Body

    if (body && typeof body === 'object') {
      const convertedAmount = (body as Record<string, unknown>).ConvertedAmount

      if (typeof convertedAmount === 'number' && Number.isFinite(convertedAmount)) {
        return convertedAmount
      }
    }

    if (typeof record.ConvertedAmount === 'number' && Number.isFinite(record.ConvertedAmount)) {
      return record.ConvertedAmount
    }
  }

  return 0
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
