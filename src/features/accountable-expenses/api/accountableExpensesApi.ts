import { apiRequest } from '../../../shared/api/apiClient'
import type {
  AccountableExpensesSearchParams,
  ConsumablesOrder,
  ConsumablesOrderItem,
  OutcomePaymentOrder,
  OutcomePaymentOrderConsumablesOrder,
} from '../types'

const UNDER_REPORT_PAGE_SIZE = 5000

export async function getAccountableExpenses(params: AccountableExpensesSearchParams): Promise<ConsumablesOrder[]> {
  const result = await apiRequest<unknown>('/payments/orders/outcome/all/underreport', {
    query: {
      limit: UNDER_REPORT_PAGE_SIZE,
      offset: 0,
      from: params.from,
      to: params.to,
      value: '',
    },
  })

  return normalizeUnderReportConsumablesOrders(result)
}

export async function searchAccountableExpenses(
  value: string,
  params: AccountableExpensesSearchParams,
): Promise<ConsumablesOrder[]> {
  const result = await apiRequest<unknown>('/payments/orders/outcome/all/underreport', {
    query: {
      limit: UNDER_REPORT_PAGE_SIZE,
      offset: 0,
      from: params.from,
      to: params.to,
      value,
    },
  })

  return normalizeUnderReportConsumablesOrders(result)
}

function normalizeUnderReportConsumablesOrders(result: unknown): ConsumablesOrder[] {
  const outcomes = readArrayPayload(result, ['Collection', 'Items', 'OutcomePaymentOrders', 'Data'])
    .map(normalizeOutcomePaymentOrder)
    .filter((outcome): outcome is OutcomePaymentOrder => Boolean(outcome))

  return outcomes.flatMap((outcome, outcomeIndex) => {
    const outcomeLinks = (outcome.OutcomePaymentOrderConsumablesOrders || []).filter((link) => !link.Deleted)

    if (outcomeLinks.length === 0) {
      return [createSyntheticConsumablesOrder(outcome, outcomeIndex)]
    }

    return outcomeLinks.map((link, linkIndex) => {
      const order = normalizeConsumablesOrder(link.ConsumablesOrder)
        || createSyntheticConsumablesOrder(outcome, `${outcomeIndex}-${linkIndex}`)
      const outcomeForLink = stripOutcomeOrderLinks(outcome)
      const nextLink: OutcomePaymentOrderConsumablesOrder = {
        ...link,
        ConsumablesOrder: order,
        OutcomePaymentOrder: outcomeForLink,
      }

      return {
        ...order,
        OutcomePaymentOrderConsumablesOrders: [nextLink],
      }
    })
  })
}

function normalizeOutcomePaymentOrder(result: unknown): OutcomePaymentOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const outcome = result as OutcomePaymentOrder

  return {
    ...outcome,
    OutcomePaymentOrderConsumablesOrders: Array.isArray(outcome.OutcomePaymentOrderConsumablesOrders)
      ? outcome.OutcomePaymentOrderConsumablesOrders
          .map(normalizeOutcomeConsumablesOrderLink)
          .filter((link): link is OutcomePaymentOrderConsumablesOrder => Boolean(link))
      : [],
  }
}

function normalizeOutcomeConsumablesOrderLink(result: unknown): OutcomePaymentOrderConsumablesOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const link = result as OutcomePaymentOrderConsumablesOrder

  return {
    ...link,
    ConsumablesOrder: normalizeConsumablesOrder(link.ConsumablesOrder),
  }
}

function createSyntheticConsumablesOrder(outcome: OutcomePaymentOrder, index: number | string): ConsumablesOrder {
  const outcomeForLink = stripOutcomeOrderLinks(outcome)

  return {
    Comment: outcome.Comment || outcome.PaymentPurpose,
    Created: outcome.Created || outcome.FromDate,
    Id: typeof outcome.Id === 'number' ? -outcome.Id : undefined,
    IsPayed: outcome.IsUnderReportDone,
    NetUid: outcome.NetUid ? `underreport-${outcome.NetUid}` : `underreport-${index}`,
    Number: outcome.Number || outcome.CustomNumber || outcome.AdvanceNumber,
    OrganizationFromDate: outcome.FromDate,
    OrganizationNumber: outcome.Number || outcome.CustomNumber,
    OutcomePaymentOrderConsumablesOrders: [
      {
        Id: typeof outcome.Id === 'number' ? -outcome.Id : undefined,
        NetUid: outcome.NetUid ? `underreport-link-${outcome.NetUid}` : `underreport-link-${index}`,
        OutcomePaymentOrder: outcomeForLink,
      },
    ],
    TotalAmount: outcome.Amount,
    User: outcome.User,
  }
}

function stripOutcomeOrderLinks(outcome: OutcomePaymentOrder): OutcomePaymentOrder {
  const { OutcomePaymentOrderConsumablesOrders: _links, ...outcomeWithoutLinks } = outcome

  return outcomeWithoutLinks
}

function normalizeConsumablesOrder(result: unknown): ConsumablesOrder | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const order = result as ConsumablesOrder

  return {
    ...order,
    ConsumablesOrderItems: Array.isArray(order.ConsumablesOrderItems)
      ? order.ConsumablesOrderItems
          .map(normalizeConsumablesOrderItem)
          .filter((item): item is ConsumablesOrderItem => Boolean(item))
      : [],
    OutcomePaymentOrderConsumablesOrders: Array.isArray(order.OutcomePaymentOrderConsumablesOrders)
      ? order.OutcomePaymentOrderConsumablesOrders
      : [],
  }
}

function normalizeConsumablesOrderItem(result: unknown): ConsumablesOrderItem | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  return result as ConsumablesOrderItem
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
