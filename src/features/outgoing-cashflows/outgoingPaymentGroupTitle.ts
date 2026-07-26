import { PaymentRegisterType } from '../income-cashflows/types'
import {
  OUTCOME_OPERATION_TYPE,
  type OutcomeOperationType,
} from './outgoingCreateTypes'

type Translate = (value: string) => string

export function parseOutgoingPaymentRegisterType(
  value: string | null,
): PaymentRegisterType {
  return value === String(PaymentRegisterType.Cash)
    ? PaymentRegisterType.Cash
    : PaymentRegisterType.Bank
}

export function parseOutgoingPaymentOperationType(
  value: string | null,
): OutcomeOperationType {
  if (value === String(OUTCOME_OPERATION_TYPE.BuyerReturn)) {
    return OUTCOME_OPERATION_TYPE.BuyerReturn
  }

  if (
    value ===
    String(OUTCOME_OPERATION_TYPE.OtherOutcomeWithCounterparts)
  ) {
    return OUTCOME_OPERATION_TYPE.OtherOutcomeWithCounterparts
  }

  if (value === String(OUTCOME_OPERATION_TYPE.OtherOutcome)) {
    return OUTCOME_OPERATION_TYPE.OtherOutcome
  }

  return OUTCOME_OPERATION_TYPE.PaymentToSupplier
}

export function getOutgoingPaymentGroupTitle(
  operationType: OutcomeOperationType,
  registerType: PaymentRegisterType,
  t: Translate,
): string {
  const registerTitle =
    registerType === PaymentRegisterType.Bank
      ? t('банківський')
      : t('касовий')

  if (operationType === OUTCOME_OPERATION_TYPE.BuyerReturn) {
    return `${t('Повернення клієнту')}, ${registerTitle}`
  }

  if (
    operationType ===
    OUTCOME_OPERATION_TYPE.OtherOutcomeWithCounterparts
  ) {
    return `${t('Інші розрахунки з контрагентами')}, ${registerTitle}`
  }

  if (operationType === OUTCOME_OPERATION_TYPE.OtherOutcome) {
    return registerType === PaymentRegisterType.Bank
      ? t('Інше списання безготівкових грошових коштів')
      : t('Інші витрати грошових коштів')
  }

  return `${t('Оплата постачальнику')}, ${registerTitle}`
}
