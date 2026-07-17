import { PaymentRegisterType } from '../income-cashflows/types'
import { OUTCOME_OPERATION_TYPE } from './outgoingCreateTypes'
import { buildAvailablePaymentsPaymentTasksPath } from './outgoingPaymentTasksRoute'

export const OUTGOING_NEW_PATH = '/accounting/outgoing-cashflow/new'
const AVAILABLE_PAYMENTS_PATH = '/accounting/available-payments'

export type OutgoingCreateMenuItem = {
  label: string
  path: string
}

type Translate = (value: string) => string

function groupPath(registerType: number, operationType: number): string {
  return `${OUTGOING_NEW_PATH}/group?type=${registerType}&operationType=${operationType}`
}

function paymentTaskPath(registerType: number): string {
  return `${AVAILABLE_PAYMENTS_PATH}?type=${registerType}&operationType=${OUTCOME_OPERATION_TYPE.PaymentToSupplierByPaymentTask}`
}

export function buildOutgoingRegisterItems(t: Translate, registerType: number): OutgoingCreateMenuItem[] {
  const isBank = registerType === PaymentRegisterType.Bank

  return [
    { label: t('Оплата постачальнику по платіжній задачі'), path: paymentTaskPath(registerType) },
    { label: t('Оплата постачальнику'), path: groupPath(registerType, OUTCOME_OPERATION_TYPE.PaymentToSupplier) },
    { label: t('Повернення грошових коштів покупцю'), path: groupPath(registerType, OUTCOME_OPERATION_TYPE.BuyerReturn) },
    { label: t('Інші розрахунки з контрагентами'), path: groupPath(registerType, OUTCOME_OPERATION_TYPE.OtherOutcomeWithCounterparts) },
    {
      label: isBank ? t('Інше списання безготівкових грошових коштів') : t('Інші витрати грошових коштів'),
      path: groupPath(registerType, OUTCOME_OPERATION_TYPE.OtherOutcome),
    },
    { label: t('Перерахування грошових коштів підзвітнику'), path: `${OUTGOING_NEW_PATH}/simple?type=${registerType}` },
  ]
}

export function buildOutgoingStandaloneItems(t: Translate): OutgoingCreateMenuItem[] {
  return [
    { label: t('По статтям витрат / під звіт'), path: `${OUTGOING_NEW_PATH}/simple` },
    { label: t('Поповнити баланс постачальника послуг'), path: `${OUTGOING_NEW_PATH}/supplier` },
    { label: t('Платіжна задача'), path: buildAvailablePaymentsPaymentTasksPath() },
    { label: t('Повернення клієнту'), path: `${OUTGOING_NEW_PATH}/client-return` },
  ]
}
