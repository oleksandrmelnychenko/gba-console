import {
  ACCOUNTING_OPERATION_ID,
  buildAccountingOperationPath,
  getAccountingOperationLabel,
  type AccountingOperationId,
  type AccountingPaymentRegisterType,
} from '../accounting/accountingOperationCatalog'
import type { PermissionKey } from '../../shared/auth/permissionKeys'
import { getIncomeCreatePermissionByOperationId } from './permissions'

export type IncomeCreateMenuItem = {
  label: string
  path: string
  permissionKey: PermissionKey
}

type Translate = (value: string) => string

const INCOME_REGISTER_OPERATION_IDS = [
  ACCOUNTING_OPERATION_ID.IncomeOther,
  ACCOUNTING_OPERATION_ID.IncomeClientPayment,
  ACCOUNTING_OPERATION_ID.IncomeSupplierReturn,
  ACCOUNTING_OPERATION_ID.IncomeOtherWithCounterparties,
] as const

export function buildIncomeRegisterItems(
  t: Translate,
  registerType: AccountingPaymentRegisterType,
): IncomeCreateMenuItem[] {
  return INCOME_REGISTER_OPERATION_IDS.map((operationId) =>
    buildMenuItem(operationId, registerType, t),
  )
}

export function buildIncomeColleagueItem(t: Translate): IncomeCreateMenuItem {
  return buildMenuItem(
    ACCOUNTING_OPERATION_ID.IncomeReturnFromColleague,
    undefined,
    t,
  )
}

export function buildIncomeShopItem(t: Translate): IncomeCreateMenuItem {
  return buildMenuItem(
    ACCOUNTING_OPERATION_ID.IncomeShopPayment,
    undefined,
    t,
  )
}

function buildMenuItem(
  operationId: AccountingOperationId,
  registerType: AccountingPaymentRegisterType | undefined,
  t: Translate,
): IncomeCreateMenuItem {
  return {
    label: t(getAccountingOperationLabel(operationId, registerType)),
    path: buildAccountingOperationPath(operationId, registerType),
    permissionKey: getIncomeCreatePermissionByOperationId(operationId),
  }
}
