import { describe, expect, it } from 'vitest'
import {
  resolveIncomePaymentOrderType,
  selectDefaultIncomePaymentMovement,
  shouldAllocateIncomePaymentToSales,
} from './incomeCashflowMutationPolicy'
import {
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

  it('requires an explicit article when no semantic match exists', () => {
    expect(
      selectDefaultIncomePaymentMovement(
        [{ Id: 1, OperationName: 'Оплата покупця' }],
        IncomePaymentOperationType.OtherIncome,
      ),
    ).toBeNull()
  })
})
