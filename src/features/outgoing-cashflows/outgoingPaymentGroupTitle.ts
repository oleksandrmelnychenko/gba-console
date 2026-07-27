import {
  ACCOUNTING_OPERATION_ID,
  ACCOUNTING_PAYMENT_REGISTER_TYPE,
  OUTCOME_PAYMENT_OPERATION_CODE,
  getAccountingOperationByPayloadType,
  getAccountingOperationLabel,
  type AccountingPaymentRegisterType,
  type OutcomePaymentOperationCode,
} from '../accounting/accountingOperationCatalog'

type Translate = (value: string) => string

export function parseOutgoingPaymentRegisterType(
  value: string | null,
): AccountingPaymentRegisterType {
  return value === String(ACCOUNTING_PAYMENT_REGISTER_TYPE.Cash)
    ? ACCOUNTING_PAYMENT_REGISTER_TYPE.Cash
    : ACCOUNTING_PAYMENT_REGISTER_TYPE.Bank
}

export function parseOutgoingPaymentOperationType(
  value: string | null,
): OutcomePaymentOperationCode {
  const operationType = Number(value)
  const operation = getAccountingOperationByPayloadType('outcome', operationType)

  if (
    operation
    && (
      operation.id === ACCOUNTING_OPERATION_ID.OutcomeSupplierPayment
      || operation.id === ACCOUNTING_OPERATION_ID.OutcomeCustomerRefund
      || operation.id === ACCOUNTING_OPERATION_ID.OutcomeOtherWithCounterparties
      || operation.id === ACCOUNTING_OPERATION_ID.OutcomeOther
    )
  ) {
    return operationType as OutcomePaymentOperationCode
  }

  return OUTCOME_PAYMENT_OPERATION_CODE.PaymentToSupplier
}

export function getOutgoingPaymentGroupTitle(
  operationType: OutcomePaymentOperationCode,
  registerType: AccountingPaymentRegisterType,
  t: Translate,
): string {
  const registerTitle =
    registerType === ACCOUNTING_PAYMENT_REGISTER_TYPE.Bank
      ? t('банківський')
      : t('касовий')
  const operation = getAccountingOperationByPayloadType('outcome', operationType)
  const operationId = operation?.id || ACCOUNTING_OPERATION_ID.OutcomeSupplierPayment

  if (operationId === ACCOUNTING_OPERATION_ID.OutcomeOther) {
    return t(getAccountingOperationLabel(operationId, registerType))
  }

  return `${t(getAccountingOperationLabel(operationId, registerType, 'form'))}, ${registerTitle}`
}
