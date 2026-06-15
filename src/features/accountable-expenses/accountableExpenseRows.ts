import type {
  AccountableExpensePaymentStatus,
  AccountableExpenseRow,
  AccountableExpenseUnderReportStatus,
  ConsumablesOrder,
  ConsumablesOrderItem,
  NamedEntity,
  OutcomePaymentOrder,
  OutcomePaymentOrderConsumablesOrder,
} from './types'

const MONEY_EPSILON = 0.005

export function buildExpenseRows(orders: ConsumablesOrder[]): AccountableExpenseRow[] {
  const rows: AccountableExpenseRow[] = []

  orders.forEach((order, orderIndex) => {
    const outcomeSummary = summarizeOutcomePaymentOrders(order)
    const items = order.ConsumablesOrderItems || []

    items.forEach((item, itemIndex) => {
      const amount = getItemTotalPriceWithVat(item)

      rows.push({
        advanceNumber: outcomeSummary.advanceNumber,
        amount,
        comment: order.Comment || outcomeSummary.comment,
        created: order.Created,
        currency: outcomeSummary.currency,
        id: String(item.NetUid || item.Id || `${order.NetUid || order.Id || orderIndex}-${itemIndex}`),
        isPayed: outcomeSummary.paymentStatus === 'paid',
        isUnderReportDone: outcomeSummary.underReportStatus === 'closed',
        item,
        order,
        organization: outcomeSummary.organization,
        payedTo: outcomeSummary.payedTo,
        paidAmount: outcomeSummary.paidAmount,
        paymentStatus: outcomeSummary.paymentStatus,
        pricePerItem: item.PricePerItem,
        productName: item.ConsumableProduct?.Name || outcomeSummary.paymentMovement,
        qty: item.Qty,
        responsible: order.User?.LastName || order.User?.FullName || order.User?.Name
          || outcomeSummary.responsible,
        underReportStatus: outcomeSummary.underReportStatus,
        vendorCode: item.ConsumableProduct?.VendorCode,
      })
    })
  })

  return rows
}

export function getOutcomePaymentOrder(order?: ConsumablesOrder | null): OutcomePaymentOrder | null {
  return getOutcomePaymentOrders(order)[0]?.OutcomePaymentOrder || null
}

export function getOutcomePaymentOrders(
  order?: ConsumablesOrder | null,
): NonNullable<ConsumablesOrder['OutcomePaymentOrderConsumablesOrders']> {
  return (order?.OutcomePaymentOrderConsumablesOrders || []).filter(
    (item) => !item.Deleted && item.OutcomePaymentOrder && !item.OutcomePaymentOrder.Deleted,
  )
}

export function getOutcomeOrderLinkKey(item: OutcomePaymentOrderConsumablesOrder, index: number): string {
  return String(item.NetUid || item.Id || item.OutcomePaymentOrder?.NetUid || item.OutcomePaymentOrder?.Id || `outcome-${index}`)
}

export function getAdvanceReportLink(outcome?: OutcomePaymentOrder | null): string | null {
  const netUid = outcome?.NetUid?.trim()

  return netUid
    ? `/accounting/outgoing-cashflow/${encodeURIComponent(netUid)}/advanced-report/view`
    : null
}

export function getPaymentStatusColor(status: AccountableExpensePaymentStatus | undefined): string {
  switch (status) {
    case 'paid':
      return 'green'
    case 'partial':
      return 'orange'
    default:
      return 'yellow'
  }
}

export function formatPaymentStatus(status: AccountableExpensePaymentStatus | undefined, t: (value: string) => string): string {
  switch (status) {
    case 'paid':
      return t('Оплачено')
    case 'partial':
      return t('Частково')
    default:
      return t('Не оплачено')
  }
}

export function formatUnderReportStatus(status: AccountableExpenseUnderReportStatus | undefined, t: (value: string) => string): string {
  switch (status) {
    case 'closed':
      return t('Так')
    case 'mixed':
      return t('Частково')
    case 'open':
      return t('Ні')
    default:
      return '—'
  }
}

type OutcomePaymentSummary = {
  advanceNumber?: string
  comment?: string
  created?: string
  currency?: string
  organization?: string
  paidAmount?: number
  payedTo?: string
  paymentMovement?: string
  paymentStatus: AccountableExpensePaymentStatus
  responsible?: string
  underReportStatus: AccountableExpenseUnderReportStatus
}

function summarizeOutcomePaymentOrders(order: ConsumablesOrder): OutcomePaymentSummary {
  const outcomeOrders = getOutcomePaymentOrders(order)
    .map((item) => item.OutcomePaymentOrder)
    .filter((outcome): outcome is OutcomePaymentOrder => Boolean(outcome))
  const underReportStates = outcomeOrders
    .filter((outcome) => outcome.IsUnderReport)
    .map((outcome) => Boolean(outcome.IsUnderReportDone))
  const paidAmount = getConsumablesOrderPaidAmount(order)
  const paymentStatus = getPaymentStatus(order, paidAmount)
  const underReportStatus = getUnderReportStatus(underReportStates)

  return {
    advanceNumber: joinUnique(outcomeOrders.map((outcome) => outcome.AdvanceNumber)),
    comment: joinUnique(outcomeOrders.flatMap((outcome) => [outcome.Comment, outcome.PaymentPurpose])),
    created: outcomeOrders[0]?.FromDate,
    currency: joinUnique(outcomeOrders.map((outcome) => outcome.PaymentCurrencyRegister?.Currency?.Code || outcome.PaymentCurrencyRegister?.Currency?.Name)),
    organization: joinUnique(outcomeOrders.map((outcome) => outcome.Organization?.Name)),
    paidAmount,
    payedTo: joinUnique(outcomeOrders.map((outcome) => getPersonName(outcome.Colleague))),
    paymentMovement: joinUnique(outcomeOrders.map((outcome) => outcome.PaymentMovementOperation?.PaymentMovement?.OperationName)),
    paymentStatus,
    responsible: joinUnique(outcomeOrders.map((outcome) => getPersonName(outcome.User))),
    underReportStatus,
  }
}

function getConsumablesOrderPaidAmount(order: ConsumablesOrder): number | undefined {
  return typeof order.TotalPaidAmount === 'number' && Number.isFinite(order.TotalPaidAmount)
    ? order.TotalPaidAmount
    : undefined
}

function getItemTotalPriceWithVat(item: ConsumablesOrderItem): number | undefined {
  if (typeof item.TotalPriceWithVAT === 'number' && Math.abs(item.TotalPriceWithVAT) > MONEY_EPSILON) {
    return item.TotalPriceWithVAT
  }

  const totalPrice = typeof item.TotalPrice === 'number' ? item.TotalPrice : 0
  const vat = typeof item.VAT === 'number' ? item.VAT : 0
  const totalPriceWithVat = totalPrice + vat

  return Math.abs(totalPriceWithVat) > MONEY_EPSILON ? totalPriceWithVat : item.TotalPriceWithVAT
}

function getPaymentStatus(order: ConsumablesOrder, paidAmount: number | undefined): AccountableExpensePaymentStatus {
  const total = getOrderPaymentTotal(order)

  if (order.IsPayed || (typeof paidAmount === 'number' && total > MONEY_EPSILON && paidAmount >= total - MONEY_EPSILON)) {
    return 'paid'
  }

  if (typeof paidAmount === 'number' && paidAmount > MONEY_EPSILON) {
    return 'partial'
  }

  return 'unpaid'
}

function getOrderPaymentTotal(order: ConsumablesOrder): number {
  return order.TotalAmount || (order.ConsumablesOrderItems || []).reduce((total, item) => total + (item.TotalPriceWithVAT || 0), 0)
}

function getUnderReportStatus(states: boolean[]): AccountableExpenseUnderReportStatus {
  if (states.length === 0) {
    return 'none'
  }

  if (states.every(Boolean)) {
    return 'closed'
  }

  if (states.some(Boolean)) {
    return 'mixed'
  }

  return 'open'
}

function joinUnique(values: Array<string | null | undefined>): string | undefined {
  const uniqueValues = values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))

  return Array.from(new Set(uniqueValues)).join(', ') || undefined
}

function getPersonName(person?: NamedEntity | null): string | undefined {
  return [person?.LastName, person?.FirstName, person?.MiddleName].filter(Boolean).join(' ')
    || person?.FullName
    || person?.Name
}
