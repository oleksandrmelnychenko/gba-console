import { describe, expect, it } from 'vitest'
import { PermissionKeys } from '../../shared/auth/permissionKeys'
import { PaymentRegisterType } from './types'
import {
  buildIncomeColleagueItem,
  buildIncomeRegisterItems,
  buildIncomeShopItem,
} from './incomeCreateMenu'

const t = (value: string) => value

describe('income create menu catalog wiring', () => {
  it.each([
    ['Каса', PaymentRegisterType.Cash],
    ['Банк', PaymentRegisterType.Bank],
  ])('maps every %s operation to its payload operation code', (_, registerType) => {
    const items = buildIncomeRegisterItems(t, registerType)

    expect(items.map((item) => item.label)).toEqual([
      registerType === PaymentRegisterType.Bank
        ? 'Інші надходження на рахунок'
        : 'Інший касовий прихід',
      'Оплата покупця',
      'Повернення постачальника',
      'Інші з контрагентами',
    ])
    expect(items.map((item) => item.path)).toEqual([
      `/accounting/income-cashflows/new/conversion?type=${registerType}`,
      `/accounting/income-cashflows/new/client?type=${registerType}&operationType=0`,
      `/accounting/income-cashflows/new/client?type=${registerType}&operationType=1`,
      `/accounting/income-cashflows/new/client?type=${registerType}&operationType=2`,
    ])
    expect(items.map((item) => item.permissionKey)).toEqual([
      PermissionKeys.FinancialAdministration.IncomeCashflows.IncomeOrder.CreateOtherIncome,
      PermissionKeys.FinancialAdministration.IncomeCashflows.IncomeOrder.CreateClientPayment,
      PermissionKeys.FinancialAdministration.IncomeCashflows.IncomeOrder.CreateSupplierReturn,
      PermissionKeys.FinancialAdministration.IncomeCashflows.IncomeOrder.CreateCounterpartyIncome,
    ])
  })

  it('keeps colleague and shop variants on their dedicated routes', () => {
    expect(buildIncomeColleagueItem(t)).toEqual({
      label: 'Повернення від колеги',
      path: '/accounting/income-cashflows/new/user',
      permissionKey: PermissionKeys.FinancialAdministration.IncomeCashflows.IncomeOrder.CreateColleagueReturn,
    })
    expect(buildIncomeShopItem(t)).toEqual({
      label: 'Оплата магазину',
      path: '/accounting/income-cashflows/new/shop',
      permissionKey: PermissionKeys.FinancialAdministration.IncomeCashflows.IncomeOrder.CreateClientPayment,
    })
  })
})
