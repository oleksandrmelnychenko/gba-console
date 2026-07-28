import { describe, expect, it } from 'vitest'
import { consoleRoutes } from '../../app/routes/consoleRoutes'
import {
  isOutcomePaymentTasksMode,
} from '../available-payments/models/availablePaymentsSearchParams'
import {
  buildOutgoingRegisterItems,
} from '../outgoing-cashflows/outgoingCreateMenu'
import {
  OUTGOING_CREATE_MODE,
  resolveOutgoingCreateMode,
} from '../outgoing-cashflows/outgoingCreateTypes'
import {
  parseOutgoingPaymentOperationType,
  parseOutgoingPaymentRegisterType,
} from '../outgoing-cashflows/outgoingPaymentGroupTitle'
import {
  ACCOUNTING_OPERATION_ID,
  ACCOUNTING_PAYMENT_REGISTER_TYPE,
  OUTCOME_PAYMENT_OPERATION_CODE,
  buildAccountingOperationPath,
  getAccountingOperation,
  type AccountingOperationId,
} from './accountingOperationCatalog'

type FinancialActionContract = {
  action: string
  operationId: AccountingOperationId | null
  routePathname: string
}

const FINANCIAL_ACTION_CONTRACTS: FinancialActionContract[] = [
  {
    action: 'supplier payment by task',
    operationId: ACCOUNTING_OPERATION_ID.OutcomeSupplierPaymentByTask,
    routePathname: '/accounting/available-payments',
  },
  {
    action: 'supplier payment',
    operationId: ACCOUNTING_OPERATION_ID.OutcomeSupplierPayment,
    routePathname: '/accounting/outgoing-cashflow/new/group',
  },
  {
    action: 'client refund',
    operationId: ACCOUNTING_OPERATION_ID.OutcomeCustomerRefund,
    routePathname: '/accounting/outgoing-cashflow/new/group',
  },
  {
    action: 'other counterparty settlements',
    operationId: ACCOUNTING_OPERATION_ID.OutcomeOtherWithCounterparties,
    routePathname: '/accounting/outgoing-cashflow/new/group',
  },
  {
    action: 'accountable-person transfer',
    operationId: ACCOUNTING_OPERATION_ID.OutcomeTransferToColleague,
    routePathname: '/accounting/outgoing-cashflow/new/simple',
  },
  {
    action: 'other expense',
    operationId: ACCOUNTING_OPERATION_ID.OutcomeOther,
    routePathname: '/accounting/outgoing-cashflow/new/group',
  },
  {
    action: 'expense by article directory',
    operationId: null,
    routePathname: '/accounting/payment-expense-articles',
  },
  {
    action: 'service-supplier balance top-up',
    operationId: ACCOUNTING_OPERATION_ID.OutcomeSupplierPayment,
    routePathname: '/accounting/outgoing-cashflow/new/group',
  },
  {
    action: 'payment task',
    operationId: ACCOUNTING_OPERATION_ID.OutcomeSupplierPaymentByTask,
    routePathname: '/accounting/available-payments',
  },
  {
    action: 'client return',
    operationId: ACCOUNTING_OPERATION_ID.OutcomeCustomerRefund,
    routePathname: '/accounting/outgoing-cashflow/new/group',
  },
]

const REGISTER_TYPES = [
  ACCOUNTING_PAYMENT_REGISTER_TYPE.Bank,
  ACCOUNTING_PAYMENT_REGISTER_TYPE.Cash,
] as const

describe('accounting financial-cycle route/form contract', () => {
  it('registers a real console route for every current business action', () => {
    const registeredPaths = new Set(consoleRoutes.map((route) => route.path))

    for (const contract of FINANCIAL_ACTION_CONTRACTS) {
      expect(
        registeredPaths.has(contract.routePathname),
        `${contract.action} -> ${contract.routePathname}`,
      ).toBe(true)
    }
  })

  it('maps every money-moving action through the canonical catalog for bank and cash', () => {
    for (const contract of FINANCIAL_ACTION_CONTRACTS) {
      if (!contract.operationId) {
        continue
      }

      for (const registerType of REGISTER_TYPES) {
        const operation = getAccountingOperation(contract.operationId)
        const path = buildAccountingOperationPath(
          contract.operationId,
          registerType,
        )
        const url = new URL(path, 'https://console.invalid')

        expect(url.pathname, contract.action).toBe(contract.routePathname)
        expect(operation.registerTypes, contract.action).toContain(registerType)

        if (
          operation.navigation.kind === 'route'
          && operation.navigation.includeRegisterType
        ) {
          expect(url.searchParams.get('type'), contract.action).toBe(
            String(registerType),
          )
        }
      }
    }
  })

  it('keeps former duplicate actions as aliases, not extra money operations', () => {
    expect(
      FINANCIAL_ACTION_CONTRACTS.find(
        (contract) => contract.action === 'service-supplier balance top-up',
      )?.operationId,
    ).toBe(ACCOUNTING_OPERATION_ID.OutcomeSupplierPayment)
    expect(
      FINANCIAL_ACTION_CONTRACTS.find(
        (contract) => contract.action === 'payment task',
      )?.operationId,
    ).toBe(ACCOUNTING_OPERATION_ID.OutcomeSupplierPaymentByTask)
    expect(
      FINANCIAL_ACTION_CONTRACTS.find(
        (contract) => contract.action === 'client return',
      )?.operationId,
    ).toBe(ACCOUNTING_OPERATION_ID.OutcomeCustomerRefund)

    const menu = buildOutgoingRegisterItems(
      (value) => value,
      ACCOUNTING_PAYMENT_REGISTER_TYPE.Bank,
    )

    expect(menu).toHaveLength(6)
    expect(
      menu.filter((item) =>
        item.path.includes(
          `operationType=${OUTCOME_PAYMENT_OPERATION_CODE.PaymentToSupplier}`,
        ),
      ),
    ).toHaveLength(1)
    expect(
      menu.filter((item) =>
        item.path.includes(
          `operationType=${OUTCOME_PAYMENT_OPERATION_CODE.BuyerReturn}`,
        ),
      ),
    ).toHaveLength(1)

    expect(
      getAccountingOperation(
        ACCOUNTING_OPERATION_ID.OutcomeSupplierPayment,
      ).counterparty,
    ).toEqual({
      kinds: ['service-supplier', 'manufacturer'],
      required: true,
      source: 'form',
    })
    expect(
      getAccountingOperation(
        ACCOUNTING_OPERATION_ID.OutcomeSupplierPaymentByTask,
      ).counterparty.source,
    ).toBe('document')
    expect(
      getAccountingOperation(
        ACCOUNTING_OPERATION_ID.OutcomeCustomerRefund,
      ).counterparty,
    ).toEqual({
      kinds: ['client'],
      required: true,
      source: 'form',
    })
  })

  it('routes group operations into the form parser without changing their codes', () => {
    for (const operationType of [
      OUTCOME_PAYMENT_OPERATION_CODE.PaymentToSupplier,
      OUTCOME_PAYMENT_OPERATION_CODE.BuyerReturn,
      OUTCOME_PAYMENT_OPERATION_CODE.OtherOutcomeWithCounterparts,
      OUTCOME_PAYMENT_OPERATION_CODE.OtherOutcome,
    ]) {
      expect(parseOutgoingPaymentOperationType(String(operationType))).toBe(
        operationType,
      )
    }

    for (const registerType of REGISTER_TYPES) {
      expect(parseOutgoingPaymentRegisterType(String(registerType))).toBe(
        registerType,
      )
    }

    expect(
      resolveOutgoingCreateMode(
        '/accounting/outgoing-cashflow/new/group',
        String(OUTCOME_PAYMENT_OPERATION_CODE.BuyerReturn),
      ),
    ).toBe(OUTGOING_CREATE_MODE.PaymentGroup)
    expect(
      resolveOutgoingCreateMode(
        '/accounting/outgoing-cashflow/new/simple',
        null,
      ),
    ).toBe(OUTGOING_CREATE_MODE.Simple)
  })

  it('routes task payments into available-payments mode and keeps the expense article route non-posting', () => {
    const taskPath = buildAccountingOperationPath(
      ACCOUNTING_OPERATION_ID.OutcomeSupplierPaymentByTask,
      ACCOUNTING_PAYMENT_REGISTER_TYPE.Bank,
    )
    const taskUrl = new URL(taskPath, 'https://console.invalid')

    expect(isOutcomePaymentTasksMode(taskUrl.searchParams)).toBe(true)

    const expenseArticleContract = FINANCIAL_ACTION_CONTRACTS.find(
      (contract) => contract.action === 'expense by article directory',
    )

    expect(expenseArticleContract?.operationId).toBeNull()
    expect(expenseArticleContract?.routePathname).toBe(
      '/accounting/payment-expense-articles',
    )
  })
})
