import {
  ACCOUNTING_OPERATION_ID,
  INCOME_PAYMENT_OPERATION_CODE,
  type AccountingOperationId,
  type IncomePaymentOperationCode,
} from '../accounting/accountingOperationCatalog'
import { PermissionKeys, type PermissionKey } from '../../shared/auth/permissionKeys'

const IncomeOrderPermissions =
  PermissionKeys.FinancialAdministration.IncomeCashflows.IncomeOrder

export const INCOME_CASHFLOWS_PAGE_PERMISSION =
  PermissionKeys.SystemPages.IncomeCashflows.View
export const INCOME_CASHFLOWS_OPEN_DETAILS_PERMISSION =
  PermissionKeys.FinancialAdministration.IncomeCashflows.Order.OpenDetails
export const INCOME_CASHFLOWS_REASSIGN_CLIENT_PERMISSION =
  PermissionKeys.FinancialAdministration.IncomeCashflows.Order.ReassignClient
export const INCOME_CASHFLOWS_CANCEL_PERMISSION =
  PermissionKeys.FinancialAdministration.IncomeCashflows.Order.Cancel
export const INCOME_CASHFLOWS_MOVEMENT_CREATE_PERMISSION =
  PermissionKeys.FinancialAdministration.CashflowArticles.Article.Create

const createPermissionByOperationId: Readonly<
  Partial<Record<AccountingOperationId, PermissionKey>>
> = {
  [ACCOUNTING_OPERATION_ID.IncomeClientPayment]:
    IncomeOrderPermissions.CreateClientPayment,
  [ACCOUNTING_OPERATION_ID.IncomeShopPayment]:
    IncomeOrderPermissions.CreateClientPayment,
  [ACCOUNTING_OPERATION_ID.IncomeSupplierReturn]:
    IncomeOrderPermissions.CreateSupplierReturn,
  [ACCOUNTING_OPERATION_ID.IncomeOtherWithCounterparties]:
    IncomeOrderPermissions.CreateCounterpartyIncome,
  [ACCOUNTING_OPERATION_ID.IncomeOther]:
    IncomeOrderPermissions.CreateOtherIncome,
  [ACCOUNTING_OPERATION_ID.IncomeReturnFromColleague]:
    IncomeOrderPermissions.CreateColleagueReturn,
}

const createPermissionByOperationType: Readonly<
  Partial<Record<IncomePaymentOperationCode, PermissionKey>>
> = {
  [INCOME_PAYMENT_OPERATION_CODE.ClientPayment]:
    IncomeOrderPermissions.CreateClientPayment,
  [INCOME_PAYMENT_OPERATION_CODE.SupplierReturn]:
    IncomeOrderPermissions.CreateSupplierReturn,
  [INCOME_PAYMENT_OPERATION_CODE.OtherAccountingWithCounterparts]:
    IncomeOrderPermissions.CreateCounterpartyIncome,
  [INCOME_PAYMENT_OPERATION_CODE.OtherIncome]:
    IncomeOrderPermissions.CreateOtherIncome,
  [INCOME_PAYMENT_OPERATION_CODE.ReturnFromColleague]:
    IncomeOrderPermissions.CreateColleagueReturn,
}

export function getIncomeCreatePermissionByOperationId(
  operationId: AccountingOperationId,
): PermissionKey {
  const permission = createPermissionByOperationId[operationId]
  if (!permission) {
    throw new Error(`Income operation ${operationId} has no create permission.`)
  }

  return permission
}

export function getIncomeCreatePermissionByOperationType(
  operationType: IncomePaymentOperationCode,
): PermissionKey {
  const permission = createPermissionByOperationType[operationType]
  if (!permission) {
    throw new Error(
      `Income operation type ${operationType} has no create permission.`,
    )
  }

  return permission
}
