import { describe, expect, it } from 'vitest'
import {
  ACCOUNTING_OPERATION_ID,
  OUTCOME_PAYMENT_OPERATION_CODE,
} from '../accounting/accountingOperationCatalog'
import { IncomeCounterpartySearchType } from '../income-cashflows/types'
import {
  getAllowedOutgoingCounterpartySearchTypes,
  getDefaultOutgoingCounterpartySearchType,
  getOutgoingPaymentGroupOperations,
  isOutgoingPaymentGroupOperationType,
  resolveOutgoingCounterpartyPayloadKind,
  validateOutgoingPaymentGroupForm,
} from './outgoingPaymentGroupPolicy'

const t = (value: string) => value

const commonValidationInput = {
  activeMovement: { Id: 31 },
  amount: 125,
  selectedCurrency: { Code: 'EUR', Id: 41 },
  selectedOrganization: { Id: 51 },
  selectedRegister: { Id: 61 },
  t,
}

describe('outgoing payment-group operation policy', () => {
  it('exposes exactly the four operations rendered by the group form', () => {
    expect(
      getOutgoingPaymentGroupOperations().map((operation) => ({
        id: operation.id,
        operationType: operation.payloadOperationTypes[0],
      })),
    ).toEqual([
      {
        id: ACCOUNTING_OPERATION_ID.OutcomeSupplierPayment,
        operationType: OUTCOME_PAYMENT_OPERATION_CODE.PaymentToSupplier,
      },
      {
        id: ACCOUNTING_OPERATION_ID.OutcomeCustomerRefund,
        operationType: OUTCOME_PAYMENT_OPERATION_CODE.BuyerReturn,
      },
      {
        id: ACCOUNTING_OPERATION_ID.OutcomeOtherWithCounterparties,
        operationType:
          OUTCOME_PAYMENT_OPERATION_CODE.OtherOutcomeWithCounterparts,
      },
      {
        id: ACCOUNTING_OPERATION_ID.OutcomeOther,
        operationType: OUTCOME_PAYMENT_OPERATION_CODE.OtherOutcome,
      },
    ])
  })

  it.each([
    OUTCOME_PAYMENT_OPERATION_CODE.PaymentToSupplier,
    OUTCOME_PAYMENT_OPERATION_CODE.BuyerReturn,
    OUTCOME_PAYMENT_OPERATION_CODE.OtherOutcomeWithCounterparts,
    OUTCOME_PAYMENT_OPERATION_CODE.OtherOutcome,
  ])('accepts operation type %s in the group form', (operationType) => {
    expect(isOutgoingPaymentGroupOperationType(operationType)).toBe(true)
  })

  it.each([
    OUTCOME_PAYMENT_OPERATION_CODE.PaymentToSupplierByPaymentTask,
    OUTCOME_PAYMENT_OPERATION_CODE.TransferToColleague,
    -1,
    undefined,
  ])('rejects non-group operation type %s', (operationType) => {
    expect(isOutgoingPaymentGroupOperationType(operationType)).toBe(false)
  })

  it('derives autocomplete types and defaults from the canonical catalog', () => {
    expect(
      getAllowedOutgoingCounterpartySearchTypes(
        OUTCOME_PAYMENT_OPERATION_CODE.PaymentToSupplier,
      ),
    ).toEqual([
      IncomeCounterpartySearchType.Supplier,
      IncomeCounterpartySearchType.Manufacturer,
    ])
    expect(
      getDefaultOutgoingCounterpartySearchType(
        OUTCOME_PAYMENT_OPERATION_CODE.PaymentToSupplier,
      ),
    ).toBe(IncomeCounterpartySearchType.Supplier)

    expect(
      getAllowedOutgoingCounterpartySearchTypes(
        OUTCOME_PAYMENT_OPERATION_CODE.BuyerReturn,
      ),
    ).toEqual([IncomeCounterpartySearchType.Client])
    expect(
      getAllowedOutgoingCounterpartySearchTypes(
        OUTCOME_PAYMENT_OPERATION_CODE.OtherOutcomeWithCounterparts,
      ),
    ).toEqual([
      IncomeCounterpartySearchType.Client,
      IncomeCounterpartySearchType.Supplier,
      IncomeCounterpartySearchType.Manufacturer,
    ])
    expect(
      getAllowedOutgoingCounterpartySearchTypes(
        OUTCOME_PAYMENT_OPERATION_CODE.OtherOutcome,
      ),
    ).toEqual([])
  })

  it('maps supplier organizations to supplier agreements and manufacturer/client rows to client agreements', () => {
    expect(
      resolveOutgoingCounterpartyPayloadKind(
        OUTCOME_PAYMENT_OPERATION_CODE.PaymentToSupplier,
        IncomeCounterpartySearchType.Supplier,
      ),
    ).toBe('supplier')
    expect(
      resolveOutgoingCounterpartyPayloadKind(
        OUTCOME_PAYMENT_OPERATION_CODE.PaymentToSupplier,
        IncomeCounterpartySearchType.Manufacturer,
      ),
    ).toBe('client')
    expect(
      resolveOutgoingCounterpartyPayloadKind(
        OUTCOME_PAYMENT_OPERATION_CODE.BuyerReturn,
        IncomeCounterpartySearchType.Client,
      ),
    ).toBe('client')
    expect(
      resolveOutgoingCounterpartyPayloadKind(
        OUTCOME_PAYMENT_OPERATION_CODE.BuyerReturn,
        IncomeCounterpartySearchType.Supplier,
      ),
    ).toBeNull()
  })

  it.each([
    {
      operationType: OUTCOME_PAYMENT_OPERATION_CODE.PaymentToSupplier,
      searchType: IncomeCounterpartySearchType.Supplier,
      selectedClient: null,
      selectedClientAgreement: null,
      selectedSupplyAgreement: { Id: 12 },
      selectedSupplyOrganization: { Id: 11 },
    },
    {
      operationType: OUTCOME_PAYMENT_OPERATION_CODE.PaymentToSupplier,
      searchType: IncomeCounterpartySearchType.Manufacturer,
      selectedClient: { Id: 21 },
      selectedClientAgreement: { Id: 22 },
      selectedSupplyAgreement: null,
      selectedSupplyOrganization: null,
    },
    {
      operationType: OUTCOME_PAYMENT_OPERATION_CODE.BuyerReturn,
      searchType: IncomeCounterpartySearchType.Client,
      selectedClient: { Id: 31 },
      selectedClientAgreement: { Id: 32 },
      selectedSupplyAgreement: null,
      selectedSupplyOrganization: null,
    },
    {
      operationType:
        OUTCOME_PAYMENT_OPERATION_CODE.OtherOutcomeWithCounterparts,
      searchType: IncomeCounterpartySearchType.Supplier,
      selectedClient: null,
      selectedClientAgreement: null,
      selectedSupplyAgreement: { Id: 42 },
      selectedSupplyOrganization: { Id: 41 },
    },
    {
      operationType: OUTCOME_PAYMENT_OPERATION_CODE.OtherOutcome,
      searchType: IncomeCounterpartySearchType.Client,
      selectedClient: null,
      selectedClientAgreement: null,
      selectedSupplyAgreement: null,
      selectedSupplyOrganization: null,
    },
  ])(
    'accepts the required counterparty/agreement contract for operation $operationType and search $searchType',
    (operationInput) => {
      expect(
        validateOutgoingPaymentGroupForm({
          ...commonValidationInput,
          ...operationInput,
        }),
      ).toBeNull()
    },
  )

  it('rejects a supplier payment without its supplier agreement', () => {
    expect(
      validateOutgoingPaymentGroupForm({
        ...commonValidationInput,
        operationType: OUTCOME_PAYMENT_OPERATION_CODE.PaymentToSupplier,
        searchType: IncomeCounterpartySearchType.Supplier,
        selectedClient: null,
        selectedClientAgreement: null,
        selectedSupplyAgreement: null,
        selectedSupplyOrganization: { Id: 11 },
      }),
    ).toBe('Оберіть договір')
  })

  it('rejects a client refund with a stale supplier autocomplete type', () => {
    expect(
      validateOutgoingPaymentGroupForm({
        ...commonValidationInput,
        operationType: OUTCOME_PAYMENT_OPERATION_CODE.BuyerReturn,
        searchType: IncomeCounterpartySearchType.Supplier,
        selectedClient: { Id: 21 },
        selectedClientAgreement: { Id: 22 },
        selectedSupplyAgreement: { Id: 12 },
        selectedSupplyOrganization: { Id: 11 },
      }),
    ).toBe('Оберіть отримувача')
  })

  it.each([
    ['amount', { amount: 0 }, 'Сума має бути більшою за нуль'],
    ['movement', { activeMovement: null }, 'Оберіть статтю руху коштів'],
    ['organization', { selectedOrganization: null }, 'Оберіть організацію'],
    ['register', { selectedRegister: null }, 'Оберіть касу або рахунок'],
    ['currency', { selectedCurrency: null }, 'Оберіть валюту'],
  ])('requires the common %s field', (_, override, expectedError) => {
    expect(
      validateOutgoingPaymentGroupForm({
        ...commonValidationInput,
        operationType: OUTCOME_PAYMENT_OPERATION_CODE.OtherOutcome,
        searchType: IncomeCounterpartySearchType.Client,
        selectedClient: null,
        selectedClientAgreement: null,
        selectedSupplyAgreement: null,
        selectedSupplyOrganization: null,
        ...override,
      }),
    ).toBe(expectedError)
  })
})
