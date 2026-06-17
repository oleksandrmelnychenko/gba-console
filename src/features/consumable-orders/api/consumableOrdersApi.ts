import { apiRequest } from '../../../shared/api/apiClient'
import type {
  ConsumableOrderCalculation,
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

export async function getConsumableOrders(params: ConsumableOrdersSearchParams): Promise<ConsumablesOrder[]> {
  const result = await apiRequest<unknown>('/consumables/orders/all', {
    query: {
      from: params.from,
      to: params.to,
    },
  })

  return normalizeConsumablesOrders(result)
}

export async function searchConsumableOrders(value: string, params?: ConsumableOrdersSearchParams): Promise<ConsumablesOrder[]> {
  const result = await apiRequest<unknown>('/consumables/orders/search', {
    query: {
      from: params?.from,
      to: params?.to,
      value,
    },
  })

  return normalizeConsumablesOrders(result)
}

export async function getConsumableOrder(netId: string): Promise<ConsumablesOrder | null> {
  const result = await apiRequest<unknown>('/consumables/orders/get', {
    query: {
      netId,
    },
  })

  return normalizeConsumablesOrder(result)
}

export async function createConsumableOrder(order: ConsumablesOrder, documents: File[]): Promise<ConsumablesOrder | null> {
  const result = await apiRequest<unknown>('/consumables/orders/upload/new', {
    method: 'POST',
    body: buildConsumableOrderFormData(order, documents),
  })

  return normalizeConsumablesOrder(result)
}

export async function updateConsumableOrder(order: ConsumablesOrder, documents: File[]): Promise<ConsumablesOrder | null> {
  const result = await apiRequest<unknown>('/consumables/orders/upload/update', {
    method: 'POST',
    body: buildConsumableOrderFormData(order, documents),
  })

  return normalizeConsumablesOrder(result)
}

export async function calculateConsumableOrder(order: ConsumablesOrder): Promise<ConsumableOrderCalculation> {
  const result = await apiRequest<unknown>('/consumables/orders/calculate', {
    method: 'POST',
    body: [order],
  })

  return normalizeConsumableOrderCalculation(result)
}

export async function searchConsumableStorages(value: string): Promise<ConsumablesStorage[]> {
  const result = await apiRequest<unknown>('/consumables/storages/search', {
    query: {
      value,
    },
  })

  return readArrayPayload(result, ['Items', 'ConsumablesStorages', 'Storages', 'Data']) as ConsumablesStorage[]
}

export async function searchSupplyOrganizations(value: string): Promise<SupplyOrganization[]> {
  const result = await apiRequest<unknown>('/supplies/organizations/all/search', {
    query: {
      value,
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
  const result = await apiRequest<unknown>('/payments/movements/new', {
    method: 'POST',
    body: {
      OperationName: operationName,
    },
  })

  return result && typeof result === 'object' ? (result as PaymentMovement) : null
}

export async function createOutcomePaymentOrder(order: OutcomePaymentOrder): Promise<OutcomePaymentOrder | null> {
  const result = await apiRequest<unknown>('/payments/orders/outcome/new', {
    method: 'POST',
    body: order,
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

function buildConsumableOrderFormData(order: ConsumablesOrder, documents: File[]): FormData {
  const formData = new FormData()
  formData.append('order', JSON.stringify(order))
  documents.forEach((document) => formData.append('documents', document))

  return formData
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
