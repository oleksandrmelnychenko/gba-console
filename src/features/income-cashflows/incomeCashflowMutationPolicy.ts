import {
  IncomeCounterpartySearchType,
  IncomePaymentOperationType,
  IncomePaymentOrderType,
  PaymentRegisterType,
} from './types'
import type { PaymentMovement } from './types'
import {
  getAccountingOperationByPayloadType,
  type AccountingCounterpartyKind,
} from '../accounting/accountingOperationCatalog'

const movementNamesByOperation: Partial<
  Record<IncomePaymentOperationType, string[]>
> = {
  [IncomePaymentOperationType.ClientPayment]: [
    'Оплата покупця',
    'Оплата покупателя',
  ],
  [IncomePaymentOperationType.SupplierReturn]: [
    'Повернення постачальника',
    'Повернення від постачальника',
    'Повернення грошових коштів від постачальника',
    'Возврат денежных средств поставщиком',
  ],
  [IncomePaymentOperationType.OtherAccountingWithCounterparts]: [
    'Інші з контрагентами',
    'Інші розрахунки із контрагентами',
    'Інші надходження з контрагентами',
    'Прочие расчеты с контрагентами',
  ],
  [IncomePaymentOperationType.OtherIncome]: [
    'Інше надходження безготівкових грошових коштів',
    'Інші надходження на рахунок',
    'Інший касовий прихід',
    'Прочие поступления денежных средств',
  ],
  [IncomePaymentOperationType.ReturnFromColleague]: [
    'Повернення від колеги',
    'Повернення грошових коштів підзвітником',
    'Возврат денежных средств подотчетником',
  ],
}

export function resolveIncomePaymentOrderType(
  registerType: number | undefined,
): IncomePaymentOrderType {
  return registerType === PaymentRegisterType.Cash
    ? IncomePaymentOrderType.Cash
    : IncomePaymentOrderType.Transfer
}

export function shouldAllocateIncomePaymentToSales(
  operationType: IncomePaymentOperationType,
  isSupplierSearch: boolean,
): boolean {
  return (
    operationType === IncomePaymentOperationType.ClientPayment &&
    !isSupplierSearch
  )
}

export function shouldAutoAllocateIncomePaymentByDefault(
  operationType: IncomePaymentOperationType,
): boolean {
  return operationType === IncomePaymentOperationType.ClientPayment
}

export function getAllowedIncomeCounterpartySearchTypes(
  operationType: IncomePaymentOperationType,
): IncomeCounterpartySearchType[] {
  const operation = getAccountingOperationByPayloadType('income', operationType)
  const searchTypes = operation?.counterparty.kinds.flatMap(toIncomeCounterpartySearchType) || []

  return [...new Set(searchTypes)]
}

export function resolveIncomeCounterpartyPayloadKind(
  operationType: IncomePaymentOperationType,
  searchType: IncomeCounterpartySearchType,
): 'client' | 'supplier' | null {
  if (
    !getAllowedIncomeCounterpartySearchTypes(operationType).includes(searchType)
  ) {
    return null
  }

  return searchType === IncomeCounterpartySearchType.Supplier
    ? 'supplier'
    : 'client'
}

export function selectDefaultIncomePaymentMovement(
  movements: PaymentMovement[],
  operationType: IncomePaymentOperationType,
): PaymentMovement | null {
  const expectedNames = new Set(
    (movementNamesByOperation[operationType] || []).map(normalizeMovementName),
  )

  if (!expectedNames.size) {
    return null
  }

  return (
    movements.find((movement) =>
      expectedNames.has(normalizeMovementName(movement.OperationName)),
    ) || null
  )
}

function normalizeMovementName(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase('uk-UA') || ''
}

function toIncomeCounterpartySearchType(
  kind: AccountingCounterpartyKind,
): IncomeCounterpartySearchType[] {
  if (kind === 'client' || kind === 'organization-client') {
    return [IncomeCounterpartySearchType.Client]
  }

  if (kind === 'manufacturer') {
    return [IncomeCounterpartySearchType.Manufacturer]
  }

  if (kind === 'supplier' || kind === 'service-supplier') {
    return [IncomeCounterpartySearchType.Supplier]
  }

  return []
}
