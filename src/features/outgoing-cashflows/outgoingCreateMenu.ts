import {
  ACCOUNTING_OPERATION_ID,
  buildAccountingOperationPath,
  getAccountingOperationLabel,
  type AccountingOperationId,
  type AccountingPaymentRegisterType,
} from '../accounting/accountingOperationCatalog'

export type OutgoingCreateMenuItem = {
  label: string
  path: string
}

type Translate = (value: string) => string

const OUTGOING_REGISTER_OPERATION_IDS = [
  ACCOUNTING_OPERATION_ID.OutcomeSupplierPaymentByTask,
  ACCOUNTING_OPERATION_ID.OutcomeSupplierPayment,
  ACCOUNTING_OPERATION_ID.OutcomeCustomerRefund,
  ACCOUNTING_OPERATION_ID.OutcomeOtherWithCounterparties,
  ACCOUNTING_OPERATION_ID.OutcomeOther,
  ACCOUNTING_OPERATION_ID.OutcomeTransferToColleague,
] as const

export function buildOutgoingRegisterItems(
  t: Translate,
  registerType: AccountingPaymentRegisterType,
): OutgoingCreateMenuItem[] {
  return OUTGOING_REGISTER_OPERATION_IDS.map((operationId) =>
    buildMenuItem(operationId, registerType, t),
  )
}

function buildMenuItem(
  operationId: AccountingOperationId,
  registerType: AccountingPaymentRegisterType | undefined,
  t: Translate,
): OutgoingCreateMenuItem {
  return {
    label: t(getAccountingOperationLabel(operationId, registerType)),
    path: buildAccountingOperationPath(operationId, registerType),
  }
}
