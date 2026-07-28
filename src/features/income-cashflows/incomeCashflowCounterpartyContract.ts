import {
  type Client,
  type ClientAgreement,
  type ClientInDebt,
  IncomeCounterpartySearchType,
  type IncomePaymentOperationType,
  type IncomePaymentOrder,
  type SupplyOrganization,
  type SupplyOrganizationAgreement,
} from './types'
import { resolveIncomeCounterpartyPayloadKind } from './incomeCashflowMutationPolicy'

export function validateIncomeCounterpartySelection({
  agreementsLoaded,
  operationType,
  searchType,
  selectedClient,
  selectedClientAgreement,
  selectedSupplyAgreement,
  selectedSupplyOrganization,
  t,
}: {
  agreementsLoaded: boolean
  operationType: IncomePaymentOperationType
  searchType: IncomeCounterpartySearchType
  selectedClient: Client | null
  selectedClientAgreement: ClientAgreement | null
  selectedSupplyAgreement: SupplyOrganizationAgreement | null
  selectedSupplyOrganization: SupplyOrganization | null
  t: (value: string) => string
}): string | null {
  const payloadKind = resolveIncomeCounterpartyPayloadKind(
    operationType,
    searchType,
  )

  if (
    !payloadKind
    || (payloadKind === 'supplier'
      ? !selectedSupplyOrganization
      : !selectedClient)
  ) {
    return t('Оберіть контрагента')
  }

  if (!agreementsLoaded) {
    return t('Не вдалося підтвердити договори контрагента')
  }

  if (
    payloadKind === 'supplier'
      ? !selectedSupplyAgreement
      : !selectedClientAgreement
  ) {
    return t('Оберіть договір')
  }

  return null
}

export function attachIncomeCounterpartyToOrder(
  order: IncomePaymentOrder,
  {
    counterpartyPayloadKind,
    selectedClient,
    selectedClientAgreement,
    selectedClientDebts,
    selectedSupplyAgreement,
    selectedSupplyOrganization,
  }: {
    counterpartyPayloadKind: 'client' | 'supplier' | null
    selectedClient: Client | null
    selectedClientAgreement: ClientAgreement | null
    selectedClientDebts: ClientInDebt[]
    selectedSupplyAgreement: SupplyOrganizationAgreement | null
    selectedSupplyOrganization: SupplyOrganization | null
  },
): IncomePaymentOrder {
  if (
    counterpartyPayloadKind === 'supplier'
    && selectedSupplyOrganization
  ) {
    return {
      ...order,
      SupplyOrganization: selectedSupplyOrganization,
      SupplyOrganizationAgreement: selectedSupplyAgreement || undefined,
    }
  }

  if (counterpartyPayloadKind === 'client' && selectedClient) {
    return {
      ...order,
      Client: {
        ...selectedClient,
        ClientAgreements: selectedClientAgreement
          ? [selectedClientAgreement]
          : selectedClient.ClientAgreements,
        ClientInDebts: selectedClientDebts,
      },
      ClientAgreement: selectedClientAgreement || undefined,
    }
  }

  return order
}
