import { toDateTimeQuery } from '../../shared/date/dateTime'
import { translate } from '../../shared/i18n/translate'
import type {
  CreatedResaleAvailabilityWithTotals,
  GroupingResaleAvailability,
  ResaleAvailabilityFilterPayload,
  ResaleAvailabilityItemModel,
} from './types'

export const EMPTY_SPECIFICATION_VALUE = '__empty_specification__'

export type ResaleAvailabilityForm = {
  amount: number
  extraChargePercent: number
  from: string
  infelicity: number
  productGroupIds: string[]
  search: string
  specificationCodes: string[]
  storageIds: string[]
  to: string
}

export function buildResalesDateQuery(from: string, to: string): { from: string; to: string } {
  return {
    from: toDateTimeQuery(from, 'start'),
    to: toDateTimeQuery(to, 'end'),
  }
}

export function buildAvailabilityPayload(form: ResaleAvailabilityForm): ResaleAvailabilityFilterPayload {
  return {
    Amount: form.amount,
    ExtraChargePercent: form.extraChargePercent,
    From: toDateTimeQuery(form.from, 'start'),
    IncludedProductGroups: parseNumberValues(form.productGroupIds),
    IncludedSpecificationCodes: form.specificationCodes.map((code) => (code === EMPTY_SPECIFICATION_VALUE ? '' : code)),
    IncludedStorages: parseNumberValues(form.storageIds),
    PossibleAmountDistinct: form.infelicity,
    Search: form.search.trim(),
    To: toDateTimeQuery(form.to, 'end'),
  }
}

export function canProcessAvailabilityRows(rows: GroupingResaleAvailability[]): boolean {
  return rows.length > 0 && rows.every((row) => Number.isFinite(readAvailabilityStorageId(row)))
}

export function mapAvailabilityToItemModel(row: GroupingResaleAvailability): ResaleAvailabilityItemModel {
  const fromStorageId = readAvailabilityStorageId(row) || 0

  return {
    Amount: row.TotalSalePrice || 0,
    ConsignmentItem: {},
    ExchangeRate: row.ExchangeRate,
    FromStorageId: fromStorageId,
    MeasureUnit: row.MeasureUnit,
    OldValue: {
      Amount: row.TotalSalePrice || 0,
      QtyToReSale: row.Qty || 0,
      SalePrice: row.SalePrice || 0,
    },
    OrganizationId: row.OrganizationId ?? row.FromStorage?.OrganizationId,
    Price: row.AccountingGrossPrice || 0,
    ProductId: row.ProductId,
    ProductName: row.ProductName,
    Profit: 0,
    Profitability: 0,
    Qty: row.Qty || 0,
    QtyToReSale: row.Qty || 0,
    ReSaleAvailabilities: [],
    SalePrice: row.SalePrice || 0,
    SpecificationCode: row.SpecificationCode,
    Vat: 0,
    VendorCode: row.VendorCode,
    Weight: row.Weight,
  }
}

export function readAvailabilityStorageId(row?: GroupingResaleAvailability): number | undefined {
  return row?.FromStorageId ?? row?.FromStorage?.Id
}

export function getProcessFromStorageId(
  processData: CreatedResaleAvailabilityWithTotals | null | undefined,
  fallbackRows: GroupingResaleAvailability[],
): number | undefined {
  const processStorageId = processData?.ReSaleAvailabilityItemModels.find((item) =>
    Number.isFinite(item.FromStorageId),
  )?.FromStorageId

  if (Number.isFinite(processStorageId)) {
    return processStorageId
  }

  return fallbackRows.map(readAvailabilityStorageId).find((storageId) => Number.isFinite(storageId))
}

export function getDateRangeError(from: string, to: string): string | null {
  if (!from || !to) {
    return translate('Оберіть діапазон дат')
  }

  const fromDate = parseDateInputValue(from, 'start')
  const toDate = parseDateInputValue(to, 'end')

  if (!fromDate || !toDate) {
    return translate('Оберіть коректний діапазон дат')
  }

  if (fromDate.getTime() > toDate.getTime()) {
    return translate('Дата “Від” не може бути більшою за дату “До”')
  }

  return null
}

function parseNumberValues(values: string[]): number[] {
  return values.reduce<number[]>((numbers, value) => {
    const numberValue = Number(value)

    if (Number.isFinite(numberValue)) {
      numbers.push(numberValue)
    }

    return numbers
  }, [])
}

function parseDateInputValue(value: string, boundary: 'start' | 'end'): Date | null {
  const match = value.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/,
  )

  if (!match) {
    return null
  }

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue, millisecondValue] = match
  const hasTime = typeof hourValue === 'string'
  const year = Number(yearValue)
  const month = Number(monthValue)
  const day = Number(dayValue)
  const hour = hasTime ? Number(hourValue) : boundary === 'end' ? 23 : 0
  const minute = hasTime ? Number(minuteValue) : boundary === 'end' ? 59 : 0
  const second = secondValue ? Number(secondValue) : boundary === 'end' && !hasTime ? 59 : 0
  const millisecond = millisecondValue
    ? Number(millisecondValue.padEnd(3, '0'))
    : boundary === 'end' && !hasTime
      ? 999
      : 0
  const date = new Date(year, month - 1, day, hour, minute, second, millisecond)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second ||
    date.getMilliseconds() !== millisecond
  ) {
    return null
  }

  return date
}
