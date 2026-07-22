import type {
  ConsumableOrderRow,
  ConsumablesOrder,
  ConsumablesOrderItem,
  NamedEntity,
  OutcomePaymentOrderConsumablesOrder,
} from '../types'

export type ConsumableOrderCellText = {
  primary: string
  secondary: string
}

export function deduplicateConsumableOrdersByIdentity(
  orders: ConsumablesOrder[],
): ConsumablesOrder[] {
  const seenIdentities = new Set<string>()

  return orders.filter((order) => {
    const identity = getConsumableOrderIdentity(order)

    if (!identity) {
      return true
    }

    if (seenIdentities.has(identity)) {
      return false
    }

    seenIdentities.add(identity)
    return true
  })
}

export function buildConsumableOrderRows(orders: ConsumablesOrder[]): ConsumableOrderRow[] {
  return orders.map((order, index) => ({
    amount: order.ConsumableProductOrganization ? order.TotalAmount : 0,
    comment: order.Comment,
    created: order.Created,
    currency: order.ConsumableProductOrganization
      ? order.SupplyOrganizationAgreement?.Currency?.Code || order.SupplyOrganizationAgreement?.Currency?.Name
      : undefined,
    id: getConsumableOrderRowId(order, index),
    isDone: order.IsDone,
    isPayed: order.IsPayed,
    itemCount: getActiveConsumableOrderItems(order).length,
    order,
    organization: getEntityName(order.SupplyOrganizationAgreement?.Organization),
    organizationFromDate: order.OrganizationFromDate,
    organizationNumber: order.OrganizationNumber,
    responsible: getEntityName(order.User),
    serviceOrganization: getEntityName(order.ConsumableProductOrganization),
    storage: getEntityName(order.ConsumablesStorage),
    totalAmountWithoutVat: order.TotalAmountWithoutVAT,
  }))
}

export function getConsumableOrderSupplierCellText(
  row: ConsumableOrderRow,
): ConsumableOrderCellText {
  const supplier = cleanText(row.serviceOrganization)
  const organization = cleanText(row.organization)
  const agreement = getOrderAgreementName(row)
  const primary = supplier || organization
  const secondary = uniqueStrings([organization, agreement])
    .filter((value) => !isSameDisplayText(value, primary))
    .join(' · ')

  return { primary, secondary }
}

export function getActiveConsumableOrderItems(
  order: ConsumablesOrder,
): ConsumablesOrderItem[] {
  return (order.ConsumablesOrderItems || []).filter((item) => item.Deleted !== true)
}

export function getActiveOutcomePaymentLinks(
  order: ConsumablesOrder,
): OutcomePaymentOrderConsumablesOrder[] {
  return (order.OutcomePaymentOrderConsumablesOrders || []).filter(
    (item) => item.Deleted !== true && item.OutcomePaymentOrder?.Deleted !== true,
  )
}

export function getEntityName(entity?: NamedEntity | null): string | undefined {
  return entity?.LastName || entity?.FullName || entity?.Name || entity?.OperationName || entity?.Code
}

export function isSameDisplayText(left?: string | null, right?: string | null): boolean {
  const normalizedLeft = normalizeComparableText(left)

  return Boolean(normalizedLeft) && normalizedLeft === normalizeComparableText(right)
}

function getConsumableOrderIdentity(order: ConsumablesOrder): string | null {
  const netUid = cleanText(order.NetUid).toLowerCase()

  if (netUid) {
    return `net:${netUid}`
  }

  return typeof order.Id === 'number' && Number.isFinite(order.Id) && order.Id > 0
    ? `id:${order.Id}`
    : null
}

function getConsumableOrderRowId(order: ConsumablesOrder, index: number): string {
  const netUid = cleanText(order.NetUid)

  if (netUid) {
    return netUid
  }

  return typeof order.Id === 'number' && Number.isFinite(order.Id) && order.Id > 0
    ? String(order.Id)
    : `row-${index}`
}

function getOrderAgreementName(row: ConsumableOrderRow): string {
  return cleanText(
    row.order.SupplyOrganizationAgreement?.Name
      || row.order.SupplyOrganizationAgreement?.Number,
  )
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map(cleanText).filter(Boolean))]
}

function cleanText(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeComparableText(value?: string | null): string {
  return cleanText(value).replace(/\s+/g, ' ').toLocaleLowerCase('uk-UA')
}
