import { apiRequest } from '../../../shared/api/apiClient'
import {
  executeAccountingMutation,
  type AccountingMutationOperationOptions,
} from '../../../shared/api/accountingMutationOperation'
import { sanitizeConsumableOrderPayload } from '../consumableOrderPayload'
import {
  executeConsumableOrderMutation,
  type ConsumableOrderMutationOperationOptions,
} from './consumableOrderMutation'
import type {
  ConsumableOrderCalculation,
  ConsumableOrdersResponse,
  ConsumableOrdersSearchParams,
  ConsumableProduct,
  ConsumableProductCategory,
  ConsumablesOrder,
  ConsumablesOrderItem,
  ConsumablesStorage,
  Organization,
  OutcomePaymentOrder,
  OutcomePaymentOrderConsumablesOrder,
  PaymentCostMovement,
  PaymentMovement,
  PaymentRegister,
  SupplyOrganization,
  User,
} from '../types'
import { isGeneralOutcomeOperationType } from '../../outgoing-cashflows/outgoingCreateTypes'

const SUPPLY_ORGANIZATION_LOOKUP_LIMIT = 20

export async function getConsumableOrders(params: ConsumableOrdersSearchParams): Promise<ConsumableOrdersResponse> {
  const result = await apiRequest<unknown>('/consumables/orders/accounting/all', {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      to: params.to,
    },
  })

  return normalizeConsumablesOrdersResponse(result)
}

export async function searchConsumableOrders(value: string, params?: ConsumableOrdersSearchParams): Promise<ConsumableOrdersResponse> {
  const result = await apiRequest<unknown>('/consumables/orders/accounting/search', {
    query: {
      from: params?.from,
      limit: params?.limit,
      offset: params?.offset,
      to: params?.to,
      value,
    },
  })

  return normalizeConsumablesOrdersResponse(result)
}

export async function getConsumableOrder(netId: string): Promise<ConsumablesOrder | null> {
  const result = await apiRequest<unknown>('/consumables/orders/accounting/get', {
    query: {
      netId,
    },
  })

  return normalizeConsumablesOrder(result)
}

export async function getConsumableOrderForPayment(netId: string): Promise<ConsumablesOrder | null> {
  const result = await apiRequest<unknown>('/consumables/orders/accounting/pay/get', {
    query: {
      netId,
    },
  })

  return normalizeConsumablesOrder(result)
}

export async function getUnpaidConsumableOrdersByOrganization(organizationNetId: string): Promise<ConsumablesOrder[]> {
  if (!organizationNetId.trim()) {
    return []
  }

  const result = await apiRequest<unknown>('/consumables/orders/all/unpaid', {
    query: {
      organizationNetId,
    },
  })

  return normalizeConsumablesOrders(result)
}

export async function createConsumableOrder(
  order: ConsumablesOrder,
  documents: File[],
  operation?: ConsumableOrderMutationOperationOptions,
): Promise<ConsumablesOrder | null> {
  const result = await executeConsumableOrderMutation({
    documents,
    kind: 'add',
    operation,
    order,
    request: (context) => apiRequest<unknown>('/consumables/orders/accounting/upload/new', {
      body: context.body,
      dedupe: false,
      headers: context.headers,
      method: 'POST',
      ...(context.signal ? { signal: context.signal } : {}),
    }),
  })

  return normalizeConsumablesOrder(result)
}

export async function updateConsumableOrder(
  order: ConsumablesOrder,
  documents: File[],
  operation?: ConsumableOrderMutationOperationOptions,
): Promise<ConsumablesOrder | null> {
  const result = await executeConsumableOrderMutation({
    documents,
    kind: 'update',
    operation,
    order,
    request: (context) => apiRequest<unknown>('/consumables/orders/accounting/upload/update', {
      body: context.body,
      dedupe: false,
      headers: context.headers,
      method: 'POST',
      ...(context.signal ? { signal: context.signal } : {}),
    }),
  })

  return normalizeConsumablesOrder(result)
}

export async function calculateConsumableOrder(order: ConsumablesOrder): Promise<ConsumableOrderCalculation> {
  const result = await apiRequest<unknown>('/consumables/orders/accounting/calculate', {
    method: 'POST',
    body: [sanitizeConsumableOrderPayload(order)],
  })

  return normalizeConsumableOrderCalculation(result)
}

export async function calculateConsumableOrderForPayment(order: ConsumablesOrder): Promise<ConsumableOrderCalculation> {
  const result = await apiRequest<unknown>('/consumables/orders/accounting/pay/calculate', {
    method: 'POST',
    body: [sanitizeConsumableOrderPayload(order)],
  })

  return normalizeConsumableOrderCalculation(result)
}

export async function searchConsumableStorages(value: string): Promise<ConsumablesStorage[]> {
  const searchValue = value.trim()
  const result = searchValue
    ? await apiRequest<unknown>('/consumables/storages/search', {
        query: {
          value: searchValue,
        },
      })
    : await apiRequest<unknown>('/consumables/storages/all')

  return readArrayPayload(result, ['Items', 'ConsumablesStorages', 'Storages', 'Data']) as ConsumablesStorage[]
}

export async function searchSupplyOrganizations(value: string): Promise<SupplyOrganization[]> {
  const searchValue = value.trim()

  if (!searchValue) {
    return []
  }

  const result = await apiRequest<unknown>('/supplies/organizations/all/search', {
    query: {
      limit: SUPPLY_ORGANIZATION_LOOKUP_LIMIT,
      offset: 0,
      value: searchValue,
    },
  })

  return normalizeSupplyOrganizations(result)
}

export async function searchConsumableProductCategories(value: string): Promise<ConsumableProductCategory[]> {
  const result = await apiRequest<unknown>('/consumables/categories/search', {
    query: {
      value,
    },
  })

  return normalizeConsumableProductCategories(result)
}

export async function searchConsumableProductsByVendorCode(value: string): Promise<ConsumableProduct[]> {
  const result = await apiRequest<unknown>('/consumables/products/search/vendorcode', {
    query: {
      value,
    },
  })

  return readArrayPayload(result, ['Items', 'ConsumableProducts', 'Products', 'Data'])
    .map(normalizeConsumableProduct)
    .filter((product): product is ConsumableProduct => Boolean(product))
}

export async function searchPaymentCostMovements(value: string): Promise<PaymentCostMovement[]> {
  const result = await apiRequest<unknown>('/payments/costs/movements/all/search', {
    query: {
      value,
    },
  })

  return readArrayPayload(result, ['Items', 'PaymentCostMovements', 'PaymentCosts', 'Data']) as PaymentCostMovement[]
}

export async function getConsumableOrderOrganizations(): Promise<Organization[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return readArrayPayload(result, ['Items', 'Organizations', 'Organisations', 'Data']) as Organization[]
}

export async function searchPaymentRegisters(value = ''): Promise<PaymentRegister[]> {
  const result = await apiRequest<unknown>('/payments/registers/search', {
    query: {
      value,
    },
  })

  return normalizePaymentRegisters(result)
}

export async function getPaymentMovements(): Promise<PaymentMovement[]> {
  const result = await apiRequest<unknown>('/payments/movements/all')

  return readArrayPayload(result, ['Items', 'PaymentMovements', 'PaymentMovements', 'Data']) as PaymentMovement[]
}

export async function searchPaymentMovements(value: string): Promise<PaymentMovement[]> {
  const result = await apiRequest<unknown>('/payments/movements/all/search', {
    query: {
      value,
    },
  })

  return readArrayPayload(result, ['Items', 'PaymentMovements', 'PaymentMovements', 'Data']) as PaymentMovement[]
}

export async function createPaymentMovement(operationName: string): Promise<PaymentMovement | null> {
  const result = await apiRequest<unknown>('/payments/movements/accounting/new', {
    method: 'POST',
    body: {
      OperationName: operationName,
    },
  })

  return result && typeof result === 'object' ? (result as PaymentMovement) : null
}

export async function createOutcomePaymentOrder(
  order: OutcomePaymentOrder,
  operation?: AccountingMutationOperationOptions,
): Promise<OutcomePaymentOrder | null> {
  if (!isGeneralOutcomeOperationType(order.OperationType)) {
    throw new Error('Видатковий ордер має некоректний тип операції')
  }

  const result = await executeAccountingMutation({
    identity: order,
    kind: 'outcome-payment:add',
    operation,
    payload: order,
    request: (payload, context) => apiRequest<unknown>('/payments/orders/outcome/consumable-orders/pay', {
      body: payload,
      dedupe: false,
      headers: context.headers,
      method: 'POST',
      ...(context.signal ? { signal: context.signal } : {}),
    }),
  })

  return normalizeOutcomePaymentOrder(result)
}

export async function getFinanceDirectorUsers(): Promise<User[]> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/all/by', {
    query: {
      types: 7,
    },
  })

  return readArrayPayload(result, ['Items', 'Users', 'Profiles', 'Data']) as User[]
}

function normalizeConsumableOrderCalculation(result: unknown): ConsumableOrderCalculation {
  const payload = result && typeof result === 'object' ? (result as Partial<ConsumableOrderCalculation>) : {}

  return {
    Collection: readArrayPayload(result, ['Collection', 'Items', 'ConsumablesOrders', 'Data'])
      .map(normalizeConsumablesOrder)
      .filter((order): order is ConsumablesOrder => Boolean(order)),
    Total: readNumber(payload.Total),
  }
}

function normalizeConsumablesOrdersResponse(result: unknown): ConsumableOrdersResponse {
  const items = normalizeConsumablesOrders(result)
  const payload = result && typeof result === 'object' && !Array.isArray(result) ? (result as Record<string, unknown>) : {}
  const total = readNumber(payload.TotalRowsQty)
    ?? readNumber(payload.TotalRowQty)
    ?? readNumber(payload.Total)
    ?? readNumber(items[0]?.TotalRowsQty)
    ?? readNumber(items[0]?.TotalRowQty)

  return {
    Items: items,
    Total: total,
  }
}

function normalizeConsumablesOrders(result: unknown): ConsumablesOrder[] {
  return readArrayPayload(result, ['Items', 'ConsumablesOrders', 'Collection', 'Data'])
    .map(normalizeConsumablesOrder)
    .filter((order): order is ConsumablesOrder => Boolean(order))
}

function normalizeConsumablesOrder(result: unknown): ConsumablesOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const order = result as ConsumablesOrder

  return {
    ...order,
    ConsumablesOrderDocuments: Array.isArray(order.ConsumablesOrderDocuments) ? order.ConsumablesOrderDocuments : [],
    ConsumablesOrderItems: Array.isArray(order.ConsumablesOrderItems)
      ? order.ConsumablesOrderItems
          .map(normalizeConsumablesOrderItem)
          .filter((item): item is ConsumablesOrderItem => Boolean(item))
      : [],
    OutcomePaymentOrderConsumablesOrders: Array.isArray(order.OutcomePaymentOrderConsumablesOrders)
      ? order.OutcomePaymentOrderConsumablesOrders
          .map(normalizeOutcomePaymentOrderConsumablesOrder)
          .filter((item): item is OutcomePaymentOrderConsumablesOrder => Boolean(item))
      : [],
  }
}

function normalizeSupplyOrganizations(result: unknown): SupplyOrganization[] {
  return readArrayPayload(result, ['Items', 'SupplyOrganizations', 'Organizations', 'Data'])
    .map(normalizeSupplyOrganization)
    .filter((organization): organization is SupplyOrganization => Boolean(organization))
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

function normalizeSupplyOrganization(result: unknown): SupplyOrganization | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const organization = result as SupplyOrganization

  return {
    ...organization,
    SupplyOrganizationAgreements: Array.isArray(organization.SupplyOrganizationAgreements)
      ? organization.SupplyOrganizationAgreements
      : [],
  }
}

function normalizeConsumableProductCategories(result: unknown): ConsumableProductCategory[] {
  return readArrayPayload(result, ['Items', 'ConsumableProductCategories', 'Categories', 'Data'])
    .map(normalizeConsumableProductCategory)
    .filter((category): category is ConsumableProductCategory => Boolean(category))
}

function normalizeConsumableProductCategory(result: unknown): ConsumableProductCategory | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const category = result as ConsumableProductCategory

  return {
    ...category,
    ConsumableProducts: Array.isArray(category.ConsumableProducts)
      ? category.ConsumableProducts
          .map((product) =>
            normalizeConsumableProduct({
              ...product,
              ConsumableProductCategory: {
                ...category,
                ConsumableProducts: undefined,
              },
            }),
          )
          .filter((product): product is ConsumableProduct => Boolean(product))
      : [],
  }
}

function normalizeConsumableProduct(result: unknown): ConsumableProduct | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return result as ConsumableProduct
}

function normalizeConsumablesOrderItem(result: unknown): ConsumablesOrderItem | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return result as ConsumablesOrderItem
}

function normalizeOutcomePaymentOrderConsumablesOrder(result: unknown): OutcomePaymentOrderConsumablesOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const item = result as OutcomePaymentOrderConsumablesOrder

  return {
    ...item,
    OutcomePaymentOrder: normalizeOutcomePaymentOrder(item.OutcomePaymentOrder),
  }
}

function normalizeOutcomePaymentOrder(result: unknown): OutcomePaymentOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return result as OutcomePaymentOrder
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
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
