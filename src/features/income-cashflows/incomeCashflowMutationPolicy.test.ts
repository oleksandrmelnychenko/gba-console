import { describe, expect, it } from 'vitest'
import {
  getAllowedIncomeCounterpartySearchTypes,
  resolveIncomePaymentOrderType,
  resolveIncomeCounterpartyPayloadKind,
  selectDefaultIncomePaymentMovement,
  shouldAllocateIncomePaymentToSales,
} from './incomeCashflowMutationPolicy'
import {
  IncomeCounterpartySearchType,
  IncomePaymentOperationType,
  IncomePaymentOrderType,
  PaymentRegisterType,
} from './types'
import type { PaymentMovement } from './types'

describe('income cash-flow mutation policy', () => {
  it.each([
    [PaymentRegisterType.Cash, IncomePaymentOrderType.Cash],
    [PaymentRegisterType.Card, IncomePaymentOrderType.Transfer],
    [PaymentRegisterType.Bank, IncomePaymentOrderType.Transfer],
  ])(
    'derives the persisted order type from register type %s',
    (registerType, expectedOrderType) => {
      expect(resolveIncomePaymentOrderType(registerType)).toBe(
        expectedOrderType,
      )
    },
  )

  it('allows debt allocation only for a customer payment', () => {
    expect(
      shouldAllocateIncomePaymentToSales(
        IncomePaymentOperationType.ClientPayment,
        false,
      ),
    ).toBe(true)
    expect(
      shouldAllocateIncomePaymentToSales(
        IncomePaymentOperationType.ClientPayment,
        true,
      ),
    ).toBe(false)

    for (const operationType of [
      IncomePaymentOperationType.SupplierReturn,
      IncomePaymentOperationType.OtherAccountingWithCounterparts,
      IncomePaymentOperationType.OtherIncome,
      IncomePaymentOperationType.ReturnFromColleague,
    ]) {
      expect(
        shouldAllocateIncomePaymentToSales(operationType, false),
      ).toBe(false)
    }
  })

  it('allows supplier organizations and manufacturer clients for SupplierReturn payloads', () => {
    expect(
      getAllowedIncomeCounterpartySearchTypes(
        IncomePaymentOperationType.SupplierReturn,
      ),
    ).toEqual([
      IncomeCounterpartySearchType.Supplier,
      IncomeCounterpartySearchType.Manufacturer,
    ])
    expect(
      resolveIncomeCounterpartyPayloadKind(
        IncomePaymentOperationType.SupplierReturn,
        IncomeCounterpartySearchType.Supplier,
      ),
    ).toBe('supplier')
    expect(
      resolveIncomeCounterpartyPayloadKind(
        IncomePaymentOperationType.SupplierReturn,
        IncomeCounterpartySearchType.Manufacturer,
      ),
    ).toBe('client')
    expect(
      resolveIncomeCounterpartyPayloadKind(
        IncomePaymentOperationType.SupplierReturn,
        IncomeCounterpartySearchType.Client,
      ),
    ).toBeNull()
  })

  it('selects the article matching the operation instead of an unrelated first row', () => {
    const movements: PaymentMovement[] = [
      { Id: 1, OperationName: 'Оплата покупця' },
      { Id: 2, OperationName: 'Повернення від постачальника' },
      { Id: 3, OperationName: 'Повернення від колеги' },
    ]

    expect(
      selectDefaultIncomePaymentMovement(
        movements,
        IncomePaymentOperationType.SupplierReturn,
      )?.Id,
    ).toBe(2)
    expect(
      selectDefaultIncomePaymentMovement(
        movements,
        IncomePaymentOperationType.ReturnFromColleague,
      )?.Id,
    ).toBe(3)
  })

  it('matches the canonical movement names currently synchronized from 1C', () => {
    const movements: PaymentMovement[] = [
      { Id: 1, OperationName: 'Оплата покупателя' },
      {
        Id: 2,
        OperationName: 'Возврат денежных средств поставщиком',
      },
      {
        Id: 3,
        OperationName: 'Прочие расчеты с контрагентами',
      },
      {
        Id: 4,
        OperationName: 'Прочие поступления денежных средств',
      },
      {
        Id: 5,
        OperationName: 'Возврат денежных средств подотчетником',
      },
    ]

    expect(
      selectDefaultIncomePaymentMovement(
        movements,
        IncomePaymentOperationType.ClientPayment,
      )?.Id,
    ).toBe(1)
    expect(
      selectDefaultIncomePaymentMovement(
        movements,
        IncomePaymentOperationType.SupplierReturn,
      )?.Id,
    ).toBe(2)
    expect(
      selectDefaultIncomePaymentMovement(
        movements,
        IncomePaymentOperationType.OtherAccountingWithCounterparts,
      )?.Id,
    ).toBe(3)
    expect(
      selectDefaultIncomePaymentMovement(
        movements,
        IncomePaymentOperationType.OtherIncome,
      )?.Id,
    ).toBe(4)
    expect(
      selectDefaultIncomePaymentMovement(
        movements,
        IncomePaymentOperationType.ReturnFromColleague,
      )?.Id,
    ).toBe(5)
  })

  it('requires an explicit article when no semantic match exists', () => {
    expect(
      selectDefaultIncomePaymentMovement(
        [{ Id: 1, OperationName: 'Оплата покупця' }],
        IncomePaymentOperationType.OtherIncome,
      ),
    ).toBeNull()
  })
})
