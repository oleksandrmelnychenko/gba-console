import { describe, expect, it } from 'vitest'
import {
  ACCOUNTING_OPERATION_ID,
  INCOME_PAYMENT_OPERATION_CODE,
} from '../accounting/accountingOperationCatalog'
import { PermissionKeys } from '../../shared/auth/permissionKeys'
import {
  getIncomeCreatePermissionByOperationId,
  getIncomeCreatePermissionByOperationType,
} from './permissions'

const incomeOrderPermissions =
  PermissionKeys.FinancialAdministration.IncomeCashflows.IncomeOrder

describe('income cashflow permission mapping', () => {
  it.each([
    [
      ACCOUNTING_OPERATION_ID.IncomeClientPayment,
      INCOME_PAYMENT_OPERATION_CODE.ClientPayment,
      incomeOrderPermissions.CreateClientPayment,
    ],
    [
      ACCOUNTING_OPERATION_ID.IncomeSupplierReturn,
      INCOME_PAYMENT_OPERATION_CODE.SupplierReturn,
      incomeOrderPermissions.CreateSupplierReturn,
    ],
    [
      ACCOUNTING_OPERATION_ID.IncomeOtherWithCounterparties,
      INCOME_PAYMENT_OPERATION_CODE.OtherAccountingWithCounterparts,
      incomeOrderPermissions.CreateCounterpartyIncome,
    ],
    [
      ACCOUNTING_OPERATION_ID.IncomeOther,
      INCOME_PAYMENT_OPERATION_CODE.OtherIncome,
      incomeOrderPermissions.CreateOtherIncome,
    ],
    [
      ACCOUNTING_OPERATION_ID.IncomeReturnFromColleague,
      INCOME_PAYMENT_OPERATION_CODE.ReturnFromColleague,
      incomeOrderPermissions.CreateColleagueReturn,
    ],
  ])('maps %s and payload %s to one canonical right', (
    operationId,
    operationType,
    permissionKey,
  ) => {
    expect(getIncomeCreatePermissionByOperationId(operationId)).toBe(
      permissionKey,
    )
    expect(getIncomeCreatePermissionByOperationType(operationType)).toBe(
      permissionKey,
    )
  })

  it('maps shop payment to client payment instead of creating a duplicate right', () => {
    expect(
      getIncomeCreatePermissionByOperationId(
        ACCOUNTING_OPERATION_ID.IncomeShopPayment,
      ),
    ).toBe(incomeOrderPermissions.CreateClientPayment)
  })

  it('fails closed for operations outside the reviewed income catalog', () => {
    expect(() =>
      getIncomeCreatePermissionByOperationId(
        ACCOUNTING_OPERATION_ID.OutcomeOther,
      ),
    ).toThrow('has no create permission')
    expect(() =>
      getIncomeCreatePermissionByOperationType(404 as never),
    ).toThrow('has no create permission')
  })
})
