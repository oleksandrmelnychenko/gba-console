import {
  ACCOUNTING_OPERATION_ID,
  getAccountingOperation,
  getAccountingOperationByPayloadType,
  type AccountingCounterpartyKind,
  type AccountingOperationDefinition,
} from '../accounting/accountingOperationCatalog'
import {
  IncomeCounterpartySearchType,
  type Client,
  type ClientAgreement,
  type Currency,
  type Organization,
  type PaymentMovement,
  type PaymentRegister,
  type SupplyOrganization,
  type SupplyOrganizationAgreement,
} from '../income-cashflows/types'
import type { OutcomeOperationType } from './outgoingCreateTypes'

const OUTGOING_PAYMENT_GROUP_OPERATION_IDS = [
  ACCOUNTING_OPERATION_ID.OutcomeSupplierPayment,
  ACCOUNTING_OPERATION_ID.OutcomeCustomerRefund,
  ACCOUNTING_OPERATION_ID.OutcomeOtherWithCounterparties,
  ACCOUNTING_OPERATION_ID.OutcomeOther,
] as const

const OUTGOING_PAYMENT_GROUP_OPERATION_ID_SET = new Set<string>(
  OUTGOING_PAYMENT_GROUP_OPERATION_IDS,
)

export function getOutgoingPaymentGroupOperations(): AccountingOperationDefinition[] {
  return OUTGOING_PAYMENT_GROUP_OPERATION_IDS.map(getAccountingOperation)
}

export function isOutgoingPaymentGroupOperationType(
  value: unknown,
): value is OutcomeOperationType {
  if (typeof value !== 'number') {
    return false
  }

  const operation = getAccountingOperationByPayloadType('outcome', value)

  return Boolean(
    operation && OUTGOING_PAYMENT_GROUP_OPERATION_ID_SET.has(operation.id),
  )
}

export function getAllowedOutgoingCounterpartySearchTypes(
  operationType: OutcomeOperationType,
): IncomeCounterpartySearchType[] {
  if (!isOutgoingPaymentGroupOperationType(operationType)) {
    return []
  }

  const operation = getAccountingOperationByPayloadType(
    'outcome',
    operationType,
  )
  const searchTypes =
    operation?.counterparty.kinds.flatMap(toCounterpartySearchType) || []

  return [...new Set(searchTypes)]
}

export function resolveOutgoingCounterpartyPayloadKind(
  operationType: OutcomeOperationType,
  searchType: IncomeCounterpartySearchType,
): 'client' | 'supplier' | null {
  if (
    !getAllowedOutgoingCounterpartySearchTypes(operationType).includes(
      searchType,
    )
  ) {
    return null
  }

  return searchType === IncomeCounterpartySearchType.Supplier
    ? 'supplier'
    : 'client'
}

export function getDefaultOutgoingCounterpartySearchType(
  operationType: OutcomeOperationType,
): IncomeCounterpartySearchType {
  const searchTypes = getAllowedOutgoingCounterpartySearchTypes(operationType)

  return searchTypes.includes(IncomeCounterpartySearchType.Supplier)
    ? IncomeCounterpartySearchType.Supplier
    : searchTypes[0] || IncomeCounterpartySearchType.Client
}

export function validateOutgoingPaymentGroupForm({
  activeMovement,
  amount,
  operationType,
  searchType,
  selectedClient,
  selectedClientAgreement,
  selectedCurrency,
  selectedOrganization,
  selectedRegister,
  selectedSupplyAgreement,
  selectedSupplyOrganization,
  t,
}: {
  activeMovement: PaymentMovement | null
  amount: number
  operationType: OutcomeOperationType
  searchType: IncomeCounterpartySearchType
  selectedClient: Client | null
  selectedClientAgreement: ClientAgreement | null
  selectedCurrency: Currency | null
  selectedOrganization: Organization | null
  selectedRegister: PaymentRegister | null
  selectedSupplyAgreement: SupplyOrganizationAgreement | null
  selectedSupplyOrganization: SupplyOrganization | null
  t: (value: string) => string
}): string | null {
  if (!isOutgoingPaymentGroupOperationType(operationType)) {
    return t('Некоректний тип видаткової операції')
  }

  if (!amount || amount <= 0) {
    return t('Сума має бути більшою за нуль')
  }

  if (!activeMovement) {
    return t('Оберіть статтю руху коштів')
  }

  const operation = getAccountingOperationByPayloadType(
    'outcome',
    operationType,
  )

  if (operation?.counterparty.required) {
    const payloadKind = resolveOutgoingCounterpartyPayloadKind(
      operationType,
      searchType,
    )
    const hasCounterparty =
      payloadKind === 'supplier'
        ? Boolean(selectedSupplyOrganization)
        : payloadKind === 'client'
          ? Boolean(selectedClient)
          : false
    const hasAgreement =
      payloadKind === 'supplier'
        ? Boolean(selectedSupplyAgreement)
        : payloadKind === 'client'
          ? Boolean(selectedClientAgreement)
          : false

    if (!hasCounterparty) {
      return t('Оберіть отримувача')
    }

    if (!hasAgreement) {
      return t('Оберіть договір')
    }
  }

  if (!selectedOrganization) {
    return t('Оберіть організацію')
  }

  if (!selectedRegister) {
    return t('Оберіть касу або рахунок')
  }

  if (!selectedCurrency) {
    return t('Оберіть валюту')
  }

  return null
}

function toCounterpartySearchType(
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
