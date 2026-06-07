import { AccountingTypeValue } from '../types'

type ParsedAccountingTypeValue = (typeof AccountingTypeValue)[keyof typeof AccountingTypeValue]

export const OUTCOME_PAYMENT_TASKS_OPERATION_TYPE = '4'

type SearchParamsReader = {
  get: (name: string) => string | null
}

export function isOutcomePaymentTasksMode(searchParams: SearchParamsReader): boolean {
  return searchParams.get('operationType') === OUTCOME_PAYMENT_TASKS_OPERATION_TYPE
}

export function parseAvailablePaymentsAccountingType(searchParams: SearchParamsReader): ParsedAccountingTypeValue {
  const explicitAccountingType = parseAccountingType(searchParams.get('typePaymentTask'))

  if (explicitAccountingType !== null) {
    return explicitAccountingType
  }

  if (isOutcomePaymentTasksMode(searchParams)) {
    return AccountingTypeValue.All
  }

  return parseAccountingType(searchParams.get('type')) ?? AccountingTypeValue.All
}

export function parseAccountingType(value: string | null): ParsedAccountingTypeValue | null {
  if (value === null || value.trim() === '') {
    return null
  }

  const numericValue = Number(value)

  if (
    numericValue === AccountingTypeValue.ManagementAccounting ||
    numericValue === AccountingTypeValue.Accounting ||
    numericValue === AccountingTypeValue.All
  ) {
    return numericValue
  }

  return null
}
