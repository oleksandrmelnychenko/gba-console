import type { AccountingCashFlowHeadItem } from './types'

export type AccountingCashFlowPaymentStatusKind = 'paid' | 'unpaid' | 'partial' | 'refunded'

export type AccountingCashFlowPaymentStatus = {
  color: string
  kind: AccountingCashFlowPaymentStatusKind
  label: string
}

const SALE_PAYMENT_STATUS_BY_TYPE: Record<string, AccountingCashFlowPaymentStatus> = {
  '0': { color: 'red', kind: 'unpaid', label: 'Не оплачено' },
  '1': { color: 'green', kind: 'paid', label: 'Оплачено' },
  '2': { color: 'green', kind: 'paid', label: 'Оплачено' },
  '3': { color: 'yellow', kind: 'partial', label: 'Оплачено частково' },
  '4': { color: 'gray', kind: 'refunded', label: 'Повернення' },
}

const STATUS_OBJECT_KEYS = [
  'BaseSalePaymentStatus',
  'RetailPaymentStatus',
  'SalePaymentStatus',
  'PaymentStatus',
  'InvoicePaymentStatus',
  'BasePaymentStatus',
]

const STATUS_TYPE_KEYS = [
  'SalePaymentStatusType',
  'RetailPaymentStatusType',
  'PaymentStatusType',
  'InvoicePaymentStatusType',
  'StatusType',
]

const STATUS_FIELD_NAME_KEYS = [
  'PaymentStatusName',
  'InvoicePaymentStatusName',
  'PaymentStatus',
  'InvoiceStatus',
  'Status',
]

const STATUS_OBJECT_NAME_KEYS = [
  ...STATUS_FIELD_NAME_KEYS,
  'Name',
  'Value',
]

const PAID_BOOLEAN_KEYS = [
  'IsPayed',
  'IsPaid',
  'IsPaymentPaid',
  'IsInvoicePaid',
  'Paid',
  'Payed',
]

export function getAccountingCashFlowPaymentStatus(
  item: AccountingCashFlowHeadItem,
): AccountingCashFlowPaymentStatus | null {
  const itemRecord = toRecord(item)
  const candidateRecords = [
    itemRecord?.Sale,
    itemRecord?.UpdatedReSaleModel,
    itemRecord?.ReSale,
    itemRecord?.IncomePaymentOrder,
    itemRecord?.OutcomePaymentOrder,
    itemRecord?.ConsumablesOrder,
    itemRecord?.SupplyPaymentTask,
    itemRecord?.SupplyOrderUkraine,
    itemRecord?.ProductIncome,
    itemRecord,
  ]

  for (const candidate of candidateRecords) {
    const status = getAccountingCashFlowRecordPaymentStatus(candidate)

    if (status) {
      return status
    }
  }

  return null
}

export function getAccountingCashFlowRecordPaymentStatus(value: unknown): AccountingCashFlowPaymentStatus | null {
  const record = toRecord(value)

  if (!record) {
    return parsePaymentStatusScalar(value)
  }

  for (const key of STATUS_OBJECT_KEYS) {
    const status = parsePaymentStatusObject(record[key])

    if (status) {
      return status
    }
  }

  const scalarStatus = readFirstStatusScalar(record, false)

  if (scalarStatus) {
    return scalarStatus
  }

  for (const key of PAID_BOOLEAN_KEYS) {
    if (typeof record[key] === 'boolean') {
      return record[key] ? SALE_PAYMENT_STATUS_BY_TYPE['1'] : SALE_PAYMENT_STATUS_BY_TYPE['0']
    }
  }

  return null
}

function parsePaymentStatusObject(value: unknown): AccountingCashFlowPaymentStatus | null {
  const record = toRecord(value)

  if (!record) {
    return parsePaymentStatusScalar(value)
  }

  const scalarStatus = readFirstStatusScalar(record, true)

  if (scalarStatus) {
    return scalarStatus
  }

  return null
}

function readFirstStatusScalar(
  record: Record<string, unknown>,
  includeStatusObjectDisplayNames: boolean,
): AccountingCashFlowPaymentStatus | null {
  for (const key of STATUS_TYPE_KEYS) {
    const status = parsePaymentStatusScalar(record[key])

    if (status) {
      return status
    }
  }

  const textKeys = includeStatusObjectDisplayNames ? STATUS_OBJECT_NAME_KEYS : STATUS_FIELD_NAME_KEYS

  for (const key of textKeys) {
    const status = parsePaymentStatusText(record[key])

    if (status) {
      return status
    }
  }

  return null
}

function parsePaymentStatusScalar(value: unknown): AccountingCashFlowPaymentStatus | null {
  if (typeof value === 'boolean') {
    return value ? SALE_PAYMENT_STATUS_BY_TYPE['1'] : SALE_PAYMENT_STATUS_BY_TYPE['0']
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return SALE_PAYMENT_STATUS_BY_TYPE[String(value)] || null
  }

  if (typeof value === 'string') {
    const numericValue = Number(value)

    if (Number.isFinite(numericValue) && value.trim() !== '') {
      return SALE_PAYMENT_STATUS_BY_TYPE[String(numericValue)] || null
    }
  }

  return parsePaymentStatusText(value)
}

function parsePaymentStatusText(value: unknown): AccountingCashFlowPaymentStatus | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '')

  if (!normalized) {
    return null
  }

  if (
    normalized.includes('notpaid')
    || normalized.includes('unpaid')
    || normalized.includes('неоплач')
    || normalized.includes('несплач')
    || normalized.includes('неоплачен')
  ) {
    return SALE_PAYMENT_STATUS_BY_TYPE['0']
  }

  if (
    normalized.includes('partialpaid')
    || normalized.includes('partlypaid')
    || normalized.includes('частково')
  ) {
    return SALE_PAYMENT_STATUS_BY_TYPE['3']
  }

  if (normalized.includes('overpaid') || normalized.includes('paid') || normalized.includes('оплач') || normalized.includes('сплач')) {
    return SALE_PAYMENT_STATUS_BY_TYPE['1']
  }

  if (normalized.includes('refund') || normalized.includes('повернен')) {
    return SALE_PAYMENT_STATUS_BY_TYPE['4']
  }

  return null
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}
