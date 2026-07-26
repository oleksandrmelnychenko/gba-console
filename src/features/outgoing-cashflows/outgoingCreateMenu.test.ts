import { describe, expect, it } from 'vitest'
import { PaymentRegisterType } from '../income-cashflows/types'
import {
  buildOutgoingRegisterItems,
  buildOutgoingStandaloneItems,
} from './outgoingCreateMenu'
import { OUTCOME_OPERATION_TYPE } from './outgoingCreateTypes'

const t = (value: string) => value

describe('outgoing create menu CRUD matrix', () => {
  it.each([
    ['Банк', PaymentRegisterType.Bank],
    ['Каса', PaymentRegisterType.Cash],
  ])('maps every %s operation to an explicit create workflow', (_, registerType) => {
    const items = buildOutgoingRegisterItems(t, registerType)

    expect(items).toHaveLength(6)
    expect(items.map((item) => item.label)).toEqual([
      'Оплата постачальнику по платіжній задачі',
      'Оплата постачальнику',
      'Повернення грошових коштів покупцю',
      'Інші розрахунки з контрагентами',
      registerType === PaymentRegisterType.Bank
        ? 'Інше списання безготівкових грошових коштів'
        : 'Інші витрати грошових коштів',
      'Перерахування грошових коштів підзвітнику',
    ])
    expect(items[0]?.path).toContain(
      `operationType=${OUTCOME_OPERATION_TYPE.PaymentToSupplierByPaymentTask}`,
    )
    expect(items[1]?.path).toContain(
      `operationType=${OUTCOME_OPERATION_TYPE.PaymentToSupplier}`,
    )
    expect(items[2]?.path).toContain(
      `operationType=${OUTCOME_OPERATION_TYPE.BuyerReturn}`,
    )
    expect(items[3]?.path).toContain(
      `operationType=${OUTCOME_OPERATION_TYPE.OtherOutcomeWithCounterparts}`,
    )
    expect(items[4]?.path).toContain(
      `operationType=${OUTCOME_OPERATION_TYPE.OtherOutcome}`,
    )
    expect(items[5]?.path).toContain(`type=${registerType}`)
  })

  it('keeps every standalone workflow reachable', () => {
    const items = buildOutgoingStandaloneItems(t)

    expect(items.map((item) => item.label)).toEqual([
      'По статтям витрат / під звіт',
      'Поповнити баланс постачальника послуг',
      'Платіжна задача',
      'Повернення клієнту',
    ])
    expect(items.every((item) => item.path.startsWith('/accounting/'))).toBe(true)
  })
})
