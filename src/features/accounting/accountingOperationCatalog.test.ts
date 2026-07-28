import { describe, expect, it } from 'vitest'
import {
  ACCOUNTING_OPERATION_CATALOG,
  ACCOUNTING_OPERATION_ID,
  ACCOUNTING_PAYMENT_REGISTER_TYPE,
  INCOME_PAYMENT_OPERATION_CODE,
  OUTCOME_PAYMENT_OPERATION_CODE,
  buildAccountingOperationPath,
  getAccountingOperation,
  getAccountingOperationByPayloadType,
} from './accountingOperationCatalog'
import {
  IncomePaymentOperationType,
  PaymentRegisterType,
} from '../income-cashflows/types'
import { OUTCOME_OPERATION_TYPE } from '../outgoing-cashflows/outgoingCreateTypes'
import { PaymentRegisterTypeValue } from '../outgoing-cashflows/advanceReportTypes'

describe('accounting operation catalog', () => {
  it('contains every declared operation exactly once', () => {
    const declaredIds = Object.values(ACCOUNTING_OPERATION_ID).toSorted()
    const catalogIds = ACCOUNTING_OPERATION_CATALOG.map((operation) => operation.id)

    expect(new Set(catalogIds).size).toBe(catalogIds.length)
    expect(catalogIds.toSorted()).toEqual(declaredIds)
  })

  it('is the source of exported payload and register constants', () => {
    expect(IncomePaymentOperationType).toBe(INCOME_PAYMENT_OPERATION_CODE)
    expect(OUTCOME_OPERATION_TYPE).toBe(OUTCOME_PAYMENT_OPERATION_CODE)
    expect(PaymentRegisterType).toBe(ACCOUNTING_PAYMENT_REGISTER_TYPE)
    expect(PaymentRegisterTypeValue).toBe(ACCOUNTING_PAYMENT_REGISTER_TYPE)
  })

  it('covers every public income and outcome payload operation code', () => {
    for (const operationType of Object.values(INCOME_PAYMENT_OPERATION_CODE)) {
      expect(getAccountingOperationByPayloadType('income', operationType)?.payloadOperationTypes)
        .toContain(operationType)
    }

    for (const operationType of Object.values(OUTCOME_PAYMENT_OPERATION_CODE)) {
      expect(getAccountingOperationByPayloadType('outcome', operationType)?.payloadOperationTypes)
        .toContain(operationType)
    }
  })

  it('keeps route operationType and register type synchronized with payload metadata', () => {
    for (const operation of ACCOUNTING_OPERATION_CATALOG) {
      if (operation.navigation.kind !== 'route') {
        continue
      }

      const registerType = operation.registerTypes.includes(ACCOUNTING_PAYMENT_REGISTER_TYPE.Cash)
        ? ACCOUNTING_PAYMENT_REGISTER_TYPE.Cash
        : operation.registerTypes[0]
      const url = new URL(
        buildAccountingOperationPath(operation.id, registerType),
        'https://console.invalid',
      )

      if (operation.navigation.includeOperationType) {
        expect(
          url.searchParams.get('operationType'),
          `${operation.id} operationType`,
        ).toBe(String(operation.payloadOperationTypes[0]))
      } else {
        expect(
          url.searchParams.has('operationType'),
          `${operation.id} must not leak an operationType`,
        ).toBe(false)
      }

      if (operation.navigation.includeRegisterType) {
        expect(
          url.searchParams.get('type'),
          `${operation.id} register type`,
        ).toBe(String(registerType))
      } else {
        expect(
          url.searchParams.has('type'),
          `${operation.id} must not leak a register type`,
        ).toBe(false)
      }
    }
  })

  it('makes every required counterparty contract explicit', () => {
    for (const operation of ACCOUNTING_OPERATION_CATALOG) {
      if (operation.counterparty.required) {
        expect(operation.counterparty.kinds.length, operation.id).toBeGreaterThan(0)
        expect(operation.counterparty.source, operation.id).not.toBe('none')
      }
    }
  })

  it('locks the current counterparty matrix used by the forms', () => {
    expect(
      getAccountingOperation(ACCOUNTING_OPERATION_ID.IncomeClientPayment).counterparty.kinds,
    ).toEqual(['client'])
    expect(
      getAccountingOperation(ACCOUNTING_OPERATION_ID.IncomeSupplierReturn).counterparty.kinds,
    ).toEqual(['supplier', 'manufacturer'])
    expect(
      getAccountingOperation(ACCOUNTING_OPERATION_ID.IncomeOtherWithCounterparties).counterparty.kinds,
    ).toEqual(['client', 'supplier', 'manufacturer'])
    expect(
      getAccountingOperation(ACCOUNTING_OPERATION_ID.OutcomeSupplierPayment).counterparty.kinds,
    ).toEqual(['service-supplier', 'manufacturer'])
    expect(
      getAccountingOperation(ACCOUNTING_OPERATION_ID.OutcomeCustomerRefund).counterparty.kinds,
    ).toEqual(['client'])
  })

  it('exposes one customer-refund form for one semantic operation', () => {
    const refunds = ACCOUNTING_OPERATION_CATALOG.filter(
      (operation) => operation.semantic === 'customer-refund',
    )

    expect(refunds.map((operation) => ({
      canonicalOperationId: operation.canonicalOperationId,
      id: operation.id,
      operationTypes: [...operation.payloadOperationTypes],
      variant: operation.variant,
    }))).toEqual([
      {
        canonicalOperationId: undefined,
        id: ACCOUNTING_OPERATION_ID.OutcomeCustomerRefund,
        operationTypes: [OUTCOME_PAYMENT_OPERATION_CODE.BuyerReturn],
        variant: 'register-group',
      },
    ])
  })

  it('keeps manual and task supplier payments distinct without duplicate links', () => {
    const supplierPayments = ACCOUNTING_OPERATION_CATALOG.filter(
      (operation) => operation.semantic === 'supplier-payment',
    )

    expect(supplierPayments.map((operation) => ({
      canonicalOperationId: operation.canonicalOperationId,
      id: operation.id,
      operationType: operation.payloadOperationTypes[0],
      variant: operation.variant,
    }))).toEqual([
      {
        canonicalOperationId: undefined,
        id: ACCOUNTING_OPERATION_ID.OutcomeSupplierPaymentByTask,
        operationType: OUTCOME_PAYMENT_OPERATION_CODE.PaymentToSupplierByPaymentTask,
        variant: 'payment-task',
      },
      {
        canonicalOperationId: undefined,
        id: ACCOUNTING_OPERATION_ID.OutcomeSupplierPayment,
        operationType: OUTCOME_PAYMENT_OPERATION_CODE.PaymentToSupplier,
        variant: 'manual',
      },
    ])
  })

  it('keeps SAD and Tax Free document actions explicit instead of assigning invented operation codes', () => {
    const documentOperations = [
      ACCOUNTING_OPERATION_ID.SadIncome,
      ACCOUNTING_OPERATION_ID.SadOutcome,
      ACCOUNTING_OPERATION_ID.TaxFreeIncome,
      ACCOUNTING_OPERATION_ID.TaxFreeOutcome,
    ].map(getAccountingOperation)

    expect(documentOperations.every((operation) => operation.navigation.kind === 'embedded')).toBe(true)
    expect(documentOperations.every((operation) => operation.payloadOperationTypes.length === 0)).toBe(true)
    expect(documentOperations.map((operation) => operation.endpoint)).toEqual([
      '/payments/orders/income/new/sad',
      '/payments/orders/outcome/new/sad',
      '/payments/orders/income/new/taxfree',
      '/payments/orders/outcome/new/taxfree',
    ])
  })

  it('does not expose the retired non-posting advance-payment workflow', () => {
    expect(
      ACCOUNTING_OPERATION_CATALOG.some(
        (operation) => operation.endpoint.startsWith('/payments/advance/'),
      ),
    ).toBe(false)
  })
})
