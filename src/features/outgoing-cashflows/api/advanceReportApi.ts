import { apiRequest } from '../../../shared/api/apiClient'
import type {
  AdvanceReportConsumablesOrder,
  AdvanceReportConsumablesOrderItem,
  AdvanceReportOrder,
  AdvanceReportOutcomePaymentOrderConsumablesOrder,
  CompanyCarFueling,
  SupplyOrganization,
} from '../advanceReportTypes'

const LOCAL_NET_UID_PREFIX = 'local-'

export async function getAdvanceReportOrder(netId: string): Promise<AdvanceReportOrder | null> {
  const result = await apiRequest<unknown>(`/payments/orders/outcome/get?netId=${encodeURIComponent(netId)}`)

  return normalizeAdvanceReportOrder(result)
}

export async function calculateAdvanceReportOrder(order: AdvanceReportOrder): Promise<AdvanceReportOrder | null> {
  const payload = sanitizeAdvanceReportOrderForCalculation(order)
  const result = await apiRequest<unknown>('/payments/orders/outcome/calculate', {
    body: payload,
    method: 'POST',
  })

  return restoreDeletedFuelings(normalizeAdvanceReportOrder(result), order)
}

export async function updateAdvanceReportOrder(
  createIncomeAutomatically: boolean,
  order: AdvanceReportOrder,
  documentFiles: File[] = [],
): Promise<AdvanceReportOrder | null> {
  const payload = sanitizeAdvanceReportOrder(order)

  if (documentFiles.length > 0) {
    const formData = new FormData()

    formData.append('order', JSON.stringify(payload))
    documentFiles.forEach((file) => formData.append('documents', file))

    const result = await apiRequest<unknown>('/payments/orders/outcome/upload/update', {
      body: formData,
      method: 'POST',
      query: {
        auto: createIncomeAutomatically,
      },
    })

    return normalizeAdvanceReportOrder(result)
  }

  const result = await apiRequest<unknown>('/payments/orders/outcome/update', {
    body: payload,
    method: 'POST',
    query: {
      auto: createIncomeAutomatically,
    },
  })

  return normalizeAdvanceReportOrder(result)
}

export async function calculateAdvanceReportConsumableOrder(
  order: AdvanceReportConsumablesOrder,
): Promise<AdvanceReportConsumablesOrder | null> {
  const result = await apiRequest<unknown>('/consumables/orders/calculate', {
    body: [order],
    method: 'POST',
  })
  const calculated = readArrayPayload(result, ['Collection', 'Items', 'ConsumablesOrders', 'Data'])[0]

  return normalizeAdvanceReportConsumablesOrder(calculated)
}

export async function calculateAdvanceReportCompanyCarFueling(
  fueling: CompanyCarFueling,
): Promise<CompanyCarFueling | null> {
  const result = await apiRequest<unknown>('/consumables/company/cars/fuelings/calculate', {
    body: [fueling],
    method: 'POST',
  })
  const calculated = readArrayPayload(result, ['Collection', 'Items', 'CompanyCarFuelings', 'Fuelings', 'Data'])[0]

  return calculated && typeof calculated === 'object' ? (calculated as CompanyCarFueling) : null
}

export async function searchAdvanceReportSupplyOrganizations(
  value: string,
  organizationNetId?: string,
): Promise<SupplyOrganization[]> {
  const result = await apiRequest<unknown>('/supplies/organizations/all/search', {
    query: {
      organizationNetId: organizationNetId || '',
      value,
    },
  })

  return readArrayPayload(result, ['Items', 'SupplyOrganizations', 'Organizations', 'Data'])
    .map(normalizeSupplyOrganization)
    .filter((organization): organization is SupplyOrganization => Boolean(organization))
}

function normalizeAdvanceReportOrder(result: unknown): AdvanceReportOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const order = result as AdvanceReportOrder

  return {
    ...order,
    CompanyCarFuelings: Array.isArray(order.CompanyCarFuelings)
      ? order.CompanyCarFuelings.filter((item): item is CompanyCarFueling => Boolean(item && typeof item === 'object'))
      : [],
    OutcomePaymentOrderConsumablesOrders: Array.isArray(order.OutcomePaymentOrderConsumablesOrders)
      ? order.OutcomePaymentOrderConsumablesOrders
          .map(normalizeConsumablesOrder)
          .filter((item): item is AdvanceReportOutcomePaymentOrderConsumablesOrder => Boolean(item))
      : [],
  }
}

function normalizeConsumablesOrder(
  result: unknown,
): AdvanceReportOutcomePaymentOrderConsumablesOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const item = result as AdvanceReportOutcomePaymentOrderConsumablesOrder
  const order = item.ConsumablesOrder

  return {
    ...item,
    ConsumablesOrder: normalizeAdvanceReportConsumablesOrder(order),
  }
}

function normalizeAdvanceReportConsumablesOrder(result: unknown): AdvanceReportConsumablesOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const order = result as AdvanceReportConsumablesOrder

  return {
    ...order,
    ConsumablesOrderItems: Array.isArray(order.ConsumablesOrderItems)
      ? order.ConsumablesOrderItems.filter(
          (orderItem): orderItem is AdvanceReportConsumablesOrderItem =>
            Boolean(orderItem && typeof orderItem === 'object'),
        )
      : [],
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

function sanitizeAdvanceReportOrder(order: AdvanceReportOrder): AdvanceReportOrder {
  return stripLocalNetUidFields(order)
}

function sanitizeAdvanceReportOrderForCalculation(order: AdvanceReportOrder): AdvanceReportOrder {
  return sanitizeAdvanceReportOrder({
    ...order,
    CompanyCarFuelings: (order.CompanyCarFuelings || []).filter((fueling) => !fueling.Deleted),
  })
}

function restoreDeletedFuelings(
  calculatedOrder: AdvanceReportOrder | null,
  sourceOrder: AdvanceReportOrder,
): AdvanceReportOrder | null {
  if (!calculatedOrder) {
    return null
  }

  const deletedFuelings = (sourceOrder.CompanyCarFuelings || []).filter((fueling) => fueling.Deleted)

  if (deletedFuelings.length === 0) {
    return calculatedOrder
  }

  return {
    ...calculatedOrder,
    CompanyCarFuelings: [
      ...(calculatedOrder.CompanyCarFuelings || []),
      ...deletedFuelings,
    ],
  }
}

function stripLocalNetUidFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripLocalNetUidFields(item)) as T
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const source = value as Record<string, unknown>
  const sanitized: Record<string, unknown> = {}

  for (const [key, item] of Object.entries(source)) {
    if (key === 'NetUid' && isLocalNetUid(item)) {
      continue
    }

    sanitized[key] = stripLocalNetUidFields(item)
  }

  return sanitized as T
}

function isLocalNetUid(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(LOCAL_NET_UID_PREFIX)
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
