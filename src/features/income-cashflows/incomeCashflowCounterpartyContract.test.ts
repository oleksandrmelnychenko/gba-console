import { describe, expect, it } from 'vitest'
import {
  attachIncomeCounterpartyToOrder,
  validateIncomeCounterpartySelection,
} from './incomeCashflowCounterpartyContract'
import {
  IncomeCounterpartySearchType,
  IncomePaymentOperationType,
} from './types'
import { resolveIncomeCounterpartyPayloadKind } from './incomeCashflowMutationPolicy'

const t = (value: string) => value
const manufacturer = { Id: 41, Name: 'SEM OTOMOTIV' }
const manufacturerAgreement = {
  Agreement: { Id: 42 },
  Id: 43,
}
const supplier = { Id: 51, Name: 'Сервісний постачальник' }
const supplierAgreement = { Id: 52 }

describe('income SupplierReturn counterparty cross-contract', () => {
  it('accepts a manufacturer only through the manufacturer autocomplete and ClientAgreement path', () => {
    const payloadKind = resolveIncomeCounterpartyPayloadKind(
      IncomePaymentOperationType.SupplierReturn,
      IncomeCounterpartySearchType.Manufacturer,
    )

    expect(payloadKind).toBe('client')
    expect(
      validateIncomeCounterpartySelection({
        agreementsLoaded: true,
        operationType: IncomePaymentOperationType.SupplierReturn,
        searchType: IncomeCounterpartySearchType.Manufacturer,
        selectedClient: manufacturer,
        selectedClientAgreement: manufacturerAgreement,
        selectedSupplyAgreement: null,
        selectedSupplyOrganization: null,
        t,
      }),
    ).toBeNull()

    const order = attachIncomeCounterpartyToOrder(
      {
        Amount: 100,
        OperationType: IncomePaymentOperationType.SupplierReturn,
      },
      {
        counterpartyPayloadKind: payloadKind,
        selectedClient: manufacturer,
        selectedClientAgreement: manufacturerAgreement,
        selectedClientDebts: [],
        selectedSupplyAgreement: null,
        selectedSupplyOrganization: null,
      },
    )

    expect(order).toMatchObject({
      Client: {
        ClientAgreements: [manufacturerAgreement],
        ClientInDebts: [],
        Id: 41,
      },
      ClientAgreement: manufacturerAgreement,
      OperationType: IncomePaymentOperationType.SupplierReturn,
    })
    expect(order.SupplyOrganization).toBeUndefined()
    expect(order.SupplyOrganizationAgreement).toBeUndefined()
  })

  it('keeps a service supplier on the SupplyOrganizationAgreement path', () => {
    const payloadKind = resolveIncomeCounterpartyPayloadKind(
      IncomePaymentOperationType.SupplierReturn,
      IncomeCounterpartySearchType.Supplier,
    )

    expect(payloadKind).toBe('supplier')
    expect(
      validateIncomeCounterpartySelection({
        agreementsLoaded: true,
        operationType: IncomePaymentOperationType.SupplierReturn,
        searchType: IncomeCounterpartySearchType.Supplier,
        selectedClient: null,
        selectedClientAgreement: null,
        selectedSupplyAgreement: supplierAgreement,
        selectedSupplyOrganization: supplier,
        t,
      }),
    ).toBeNull()

    const order = attachIncomeCounterpartyToOrder(
      {
        Amount: 100,
        OperationType: IncomePaymentOperationType.SupplierReturn,
      },
      {
        counterpartyPayloadKind: payloadKind,
        selectedClient: null,
        selectedClientAgreement: null,
        selectedClientDebts: [],
        selectedSupplyAgreement: supplierAgreement,
        selectedSupplyOrganization: supplier,
      },
    )

    expect(order).toMatchObject({
      OperationType: IncomePaymentOperationType.SupplierReturn,
      SupplyOrganization: supplier,
      SupplyOrganizationAgreement: supplierAgreement,
    })
    expect(order.Client).toBeUndefined()
    expect(order.ClientAgreement).toBeUndefined()
  })

  it('does not widen SupplierReturn to an ordinary client', () => {
    expect(
      resolveIncomeCounterpartyPayloadKind(
        IncomePaymentOperationType.SupplierReturn,
        IncomeCounterpartySearchType.Client,
      ),
    ).toBeNull()
    expect(
      validateIncomeCounterpartySelection({
        agreementsLoaded: true,
        operationType: IncomePaymentOperationType.SupplierReturn,
        searchType: IncomeCounterpartySearchType.Client,
        selectedClient: { Id: 61, Name: 'Звичайний клієнт' },
        selectedClientAgreement: { Id: 62 },
        selectedSupplyAgreement: null,
        selectedSupplyOrganization: null,
        t,
      }),
    ).toBe('Оберіть контрагента')
  })

  it.each([
    {
      searchType: IncomeCounterpartySearchType.Manufacturer,
      selectedClient: manufacturer,
      selectedClientAgreement: null,
      selectedSupplyAgreement: null,
      selectedSupplyOrganization: null,
    },
    {
      searchType: IncomeCounterpartySearchType.Supplier,
      selectedClient: null,
      selectedClientAgreement: null,
      selectedSupplyAgreement: null,
      selectedSupplyOrganization: supplier,
    },
  ])(
    'requires the matching agreement for search type $searchType',
    ({
      searchType,
      selectedClient,
      selectedClientAgreement,
      selectedSupplyAgreement,
      selectedSupplyOrganization,
    }) => {
      expect(
        validateIncomeCounterpartySelection({
          agreementsLoaded: true,
          operationType: IncomePaymentOperationType.SupplierReturn,
          searchType,
          selectedClient,
          selectedClientAgreement,
          selectedSupplyAgreement,
          selectedSupplyOrganization,
          t,
        }),
      ).toBe('Оберіть договір')
    },
  )
})
