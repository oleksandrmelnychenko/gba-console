import { apiRequest } from '../../../shared/api/apiClient'
import type {
  AvailablePaymentsOrganization,
  AvailablePaymentsSearchParams,
  GroupedPaymentTask,
  GroupedPaymentTaskWithTotals,
  PriceTotal,
} from '../types'

export async function getGroupedPaymentTasks(
  params: AvailablePaymentsSearchParams,
): Promise<GroupedPaymentTaskWithTotals> {
  const result = await apiRequest<unknown>('/payments/tasks/grouped/all/filtered', {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      organizationNetId: params.organizationNetId,
      to: params.to,
      typePaymentTask: params.typePaymentTask,
    },
  })

  return normalizeGroupedPaymentTaskWithTotals(result)
}

export async function getAvailablePaymentsOrganizations(): Promise<AvailablePaymentsOrganization[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return normalizeOrganizations(result)
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
