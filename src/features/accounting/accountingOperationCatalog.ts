export const ACCOUNTING_PAYMENT_REGISTER_TYPE = {
  Cash: 0,
  Card: 1,
  Bank: 2,
} as const

export type AccountingPaymentRegisterType =
  (typeof ACCOUNTING_PAYMENT_REGISTER_TYPE)[keyof typeof ACCOUNTING_PAYMENT_REGISTER_TYPE]

export const INCOME_PAYMENT_OPERATION_CODE = {
  ClientPayment: 0,
  SupplierReturn: 1,
  OtherAccountingWithCounterparts: 2,
  OtherIncome: 3,
  ReturnFromColleague: 9,
} as const

export type IncomePaymentOperationCode =
  (typeof INCOME_PAYMENT_OPERATION_CODE)[keyof typeof INCOME_PAYMENT_OPERATION_CODE]

export const OUTCOME_PAYMENT_OPERATION_CODE = {
  PaymentToSupplierByPaymentTask: 4,
  PaymentToSupplier: 5,
  BuyerReturn: 6,
  OtherOutcomeWithCounterparts: 7,
  OtherOutcome: 8,
  TransferToColleague: 10,
} as const

export type OutcomePaymentOperationCode =
  (typeof OUTCOME_PAYMENT_OPERATION_CODE)[keyof typeof OUTCOME_PAYMENT_OPERATION_CODE]

export const ACCOUNTING_OPERATION_ID = {
  IncomeOther: 'income.other',
  IncomeClientPayment: 'income.client-payment',
  IncomeSupplierReturn: 'income.supplier-return',
  IncomeOtherWithCounterparties: 'income.other-with-counterparties',
  IncomeReturnFromColleague: 'income.return-from-colleague',
  IncomeShopPayment: 'income.shop-payment',
  OutcomeSupplierPaymentByTask: 'outcome.supplier-payment-by-task',
  OutcomeSupplierPayment: 'outcome.supplier-payment',
  OutcomeCustomerRefund: 'outcome.customer-refund',
  OutcomeOtherWithCounterparties: 'outcome.other-with-counterparties',
  OutcomeOther: 'outcome.other',
  OutcomeTransferToColleague: 'outcome.transfer-to-colleague',
  SadIncome: 'sad.income',
  SadOutcome: 'sad.outcome',
  TaxFreeIncome: 'tax-free.income',
  TaxFreeOutcome: 'tax-free.outcome',
} as const

export type AccountingOperationId =
  (typeof ACCOUNTING_OPERATION_ID)[keyof typeof ACCOUNTING_OPERATION_ID]

export type AccountingOperationDirection = 'income' | 'outcome'

export type AccountingCounterpartyKind =
  | 'client'
  | 'colleague'
  | 'manufacturer'
  | 'organization-client'
  | 'service-supplier'
  | 'supplier'

export type AccountingOperationDefinition = {
  canonicalOperationId?: AccountingOperationId
  counterparty: {
    kinds: readonly AccountingCounterpartyKind[]
    required: boolean
    source: 'document' | 'form' | 'none'
  }
  direction: AccountingOperationDirection
  endpoint: string
  id: AccountingOperationId
  labels: {
    cashMenu?: string
    form: string
    list: string
    menu: string
    option?: string
    bankMenu?: string
  }
  navigation:
    | {
        includeOperationType: boolean
        includeRegisterType: boolean
        kind: 'route'
        pathname: string
      }
    | {
        hostPathname: string
        kind: 'embedded'
      }
  payloadOperationTypes: readonly number[]
  registerTypes: readonly AccountingPaymentRegisterType[]
  semantic: string
  variant: string
}

const CASH_AND_BANK = [
  ACCOUNTING_PAYMENT_REGISTER_TYPE.Cash,
  ACCOUNTING_PAYMENT_REGISTER_TYPE.Bank,
] as const

const ANY_REGISTER = [
  ACCOUNTING_PAYMENT_REGISTER_TYPE.Cash,
  ACCOUNTING_PAYMENT_REGISTER_TYPE.Card,
  ACCOUNTING_PAYMENT_REGISTER_TYPE.Bank,
] as const

const INCOME_PATH = '/accounting/income-cashflows/new'
const OUTCOME_PATH = '/accounting/outgoing-cashflow/new'
const AVAILABLE_PAYMENTS_PATH = '/accounting/available-payments'

export const ACCOUNTING_OPERATION_CATALOG: readonly AccountingOperationDefinition[] = [
  {
    counterparty: { kinds: [], required: false, source: 'none' },
    direction: 'income',
    endpoint: '/payments/orders/income/new',
    id: ACCOUNTING_OPERATION_ID.IncomeOther,
    labels: {
      bankMenu: 'Інші надходження на рахунок',
      cashMenu: 'Інший касовий прихід',
      form: 'Інший прихід',
      list: 'Інший прихід',
      menu: 'Інший прихід',
    },
    navigation: {
      includeOperationType: false,
      includeRegisterType: true,
      kind: 'route',
      pathname: `${INCOME_PATH}/conversion`,
    },
    payloadOperationTypes: [INCOME_PAYMENT_OPERATION_CODE.OtherIncome],
    registerTypes: CASH_AND_BANK,
    semantic: 'other-income',
    variant: 'manual',
  },
  {
    counterparty: { kinds: ['client'], required: true, source: 'form' },
    direction: 'income',
    endpoint: '/payments/orders/income/new',
    id: ACCOUNTING_OPERATION_ID.IncomeClientPayment,
    labels: {
      form: 'Оплата покупця',
      list: 'Оплата покупця',
      menu: 'Оплата покупця',
    },
    navigation: {
      includeOperationType: true,
      includeRegisterType: true,
      kind: 'route',
      pathname: `${INCOME_PATH}/client`,
    },
    payloadOperationTypes: [INCOME_PAYMENT_OPERATION_CODE.ClientPayment],
    registerTypes: CASH_AND_BANK,
    semantic: 'customer-payment',
    variant: 'manual',
  },
  {
    counterparty: {
      kinds: ['supplier', 'manufacturer'],
      required: true,
      source: 'form',
    },
    direction: 'income',
    endpoint: '/payments/orders/income/new',
    id: ACCOUNTING_OPERATION_ID.IncomeSupplierReturn,
    labels: {
      form: 'Повернення від постачальника',
      list: 'Повернення постачальника',
      menu: 'Повернення постачальника',
    },
    navigation: {
      includeOperationType: true,
      includeRegisterType: true,
      kind: 'route',
      pathname: `${INCOME_PATH}/client`,
    },
    payloadOperationTypes: [INCOME_PAYMENT_OPERATION_CODE.SupplierReturn],
    registerTypes: CASH_AND_BANK,
    semantic: 'supplier-refund',
    variant: 'manual',
  },
  {
    counterparty: {
      kinds: ['client', 'supplier', 'manufacturer'],
      required: true,
      source: 'form',
    },
    direction: 'income',
    endpoint: '/payments/orders/income/new',
    id: ACCOUNTING_OPERATION_ID.IncomeOtherWithCounterparties,
    labels: {
      form: 'Інші надходження з контрагентами',
      list: 'Інші з контрагентами',
      menu: 'Інші з контрагентами',
    },
    navigation: {
      includeOperationType: true,
      includeRegisterType: true,
      kind: 'route',
      pathname: `${INCOME_PATH}/client`,
    },
    payloadOperationTypes: [INCOME_PAYMENT_OPERATION_CODE.OtherAccountingWithCounterparts],
    registerTypes: CASH_AND_BANK,
    semantic: 'other-income-with-counterparty',
    variant: 'manual',
  },
  {
    counterparty: { kinds: ['colleague'], required: true, source: 'form' },
    direction: 'income',
    endpoint: '/payments/orders/income/new',
    id: ACCOUNTING_OPERATION_ID.IncomeReturnFromColleague,
    labels: {
      form: 'Повернення від колеги',
      list: 'Повернення від колеги',
      menu: 'Повернення від колеги',
    },
    navigation: {
      includeOperationType: false,
      includeRegisterType: false,
      kind: 'route',
      pathname: `${INCOME_PATH}/user`,
    },
    payloadOperationTypes: [INCOME_PAYMENT_OPERATION_CODE.ReturnFromColleague],
    registerTypes: ANY_REGISTER,
    semantic: 'colleague-refund',
    variant: 'manual',
  },
  {
    canonicalOperationId: ACCOUNTING_OPERATION_ID.IncomeClientPayment,
    counterparty: { kinds: ['client'], required: true, source: 'document' },
    direction: 'income',
    endpoint: '/payments/orders/income/new',
    id: ACCOUNTING_OPERATION_ID.IncomeShopPayment,
    labels: {
      form: 'Оплата магазину',
      list: 'Оплата покупця',
      menu: 'Оплата магазину',
    },
    navigation: {
      includeOperationType: false,
      includeRegisterType: false,
      kind: 'route',
      pathname: `${INCOME_PATH}/shop`,
    },
    payloadOperationTypes: [INCOME_PAYMENT_OPERATION_CODE.ClientPayment],
    registerTypes: ANY_REGISTER,
    semantic: 'customer-payment',
    variant: 'shop',
  },
  {
    counterparty: {
      kinds: ['supplier', 'manufacturer', 'service-supplier'],
      required: true,
      source: 'document',
    },
    direction: 'outcome',
    endpoint: '/payments/orders/outcome/available-payments/new/supplies',
    id: ACCOUNTING_OPERATION_ID.OutcomeSupplierPaymentByTask,
    labels: {
      form: 'Оплата постачальнику по платіжній задачі',
      list: 'Оплата постачальнику по платіжній задачі',
      menu: 'Оплата постачальнику по платіжній задачі',
    },
    navigation: {
      includeOperationType: true,
      includeRegisterType: true,
      kind: 'route',
      pathname: AVAILABLE_PAYMENTS_PATH,
    },
    payloadOperationTypes: [OUTCOME_PAYMENT_OPERATION_CODE.PaymentToSupplierByPaymentTask],
    registerTypes: CASH_AND_BANK,
    semantic: 'supplier-payment',
    variant: 'payment-task',
  },
  {
    counterparty: {
      kinds: ['service-supplier', 'manufacturer'],
      required: true,
      source: 'form',
    },
    direction: 'outcome',
    endpoint: '/payments/orders/outcome/new',
    id: ACCOUNTING_OPERATION_ID.OutcomeSupplierPayment,
    labels: {
      form: 'Оплата постачальнику',
      list: 'Оплата постачальнику',
      menu: 'Оплата постачальнику',
      option: 'Постачальнику',
    },
    navigation: {
      includeOperationType: true,
      includeRegisterType: true,
      kind: 'route',
      pathname: `${OUTCOME_PATH}/group`,
    },
    payloadOperationTypes: [OUTCOME_PAYMENT_OPERATION_CODE.PaymentToSupplier],
    registerTypes: CASH_AND_BANK,
    semantic: 'supplier-payment',
    variant: 'manual',
  },
  {
    counterparty: { kinds: ['client'], required: true, source: 'form' },
    direction: 'outcome',
    endpoint: '/payments/orders/outcome/new',
    id: ACCOUNTING_OPERATION_ID.OutcomeCustomerRefund,
    labels: {
      form: 'Повернення клієнту',
      list: 'Повернення клієнту',
      menu: 'Повернення грошових коштів покупцю',
      option: 'Повернення клієнту',
    },
    navigation: {
      includeOperationType: true,
      includeRegisterType: true,
      kind: 'route',
      pathname: `${OUTCOME_PATH}/group`,
    },
    payloadOperationTypes: [OUTCOME_PAYMENT_OPERATION_CODE.BuyerReturn],
    registerTypes: CASH_AND_BANK,
    semantic: 'customer-refund',
    variant: 'register-group',
  },
  {
    counterparty: {
      kinds: ['client', 'supplier', 'manufacturer'],
      required: true,
      source: 'form',
    },
    direction: 'outcome',
    endpoint: '/payments/orders/outcome/new',
    id: ACCOUNTING_OPERATION_ID.OutcomeOtherWithCounterparties,
    labels: {
      form: 'Інші розрахунки з контрагентами',
      list: 'Інші розрахунки з контрагентами',
      menu: 'Інші розрахунки з контрагентами',
      option: 'Інші з контрагентами',
    },
    navigation: {
      includeOperationType: true,
      includeRegisterType: true,
      kind: 'route',
      pathname: `${OUTCOME_PATH}/group`,
    },
    payloadOperationTypes: [OUTCOME_PAYMENT_OPERATION_CODE.OtherOutcomeWithCounterparts],
    registerTypes: CASH_AND_BANK,
    semantic: 'other-outcome-with-counterparty',
    variant: 'manual',
  },
  {
    counterparty: { kinds: [], required: false, source: 'none' },
    direction: 'outcome',
    endpoint: '/payments/orders/outcome/new',
    id: ACCOUNTING_OPERATION_ID.OutcomeOther,
    labels: {
      bankMenu: 'Інше списання безготівкових грошових коштів',
      cashMenu: 'Інші витрати грошових коштів',
      form: 'Інші кошти',
      list: 'Інші витрати грошових коштів',
      menu: 'Інші витрати грошових коштів',
      option: 'Інші кошти',
    },
    navigation: {
      includeOperationType: true,
      includeRegisterType: true,
      kind: 'route',
      pathname: `${OUTCOME_PATH}/group`,
    },
    payloadOperationTypes: [OUTCOME_PAYMENT_OPERATION_CODE.OtherOutcome],
    registerTypes: CASH_AND_BANK,
    semantic: 'other-outcome',
    variant: 'register-group',
  },
  {
    counterparty: { kinds: ['colleague'], required: true, source: 'form' },
    direction: 'outcome',
    endpoint: '/payments/orders/outcome/new',
    id: ACCOUNTING_OPERATION_ID.OutcomeTransferToColleague,
    labels: {
      form: 'Перерахування грошових коштів підзвітнику',
      list: 'Перерахування грошових коштів підзвітнику',
      menu: 'Перерахування грошових коштів підзвітнику',
    },
    navigation: {
      includeOperationType: false,
      includeRegisterType: true,
      kind: 'route',
      pathname: `${OUTCOME_PATH}/simple`,
    },
    payloadOperationTypes: [OUTCOME_PAYMENT_OPERATION_CODE.TransferToColleague],
    registerTypes: CASH_AND_BANK,
    semantic: 'colleague-transfer',
    variant: 'under-report',
  },
  {
    counterparty: {
      kinds: ['client', 'organization-client'],
      required: true,
      source: 'document',
    },
    direction: 'income',
    endpoint: '/payments/orders/income/new/sad',
    id: ACCOUNTING_OPERATION_ID.SadIncome,
    labels: {
      form: 'Прибутковий касовий ордер із САД',
      list: 'Прибутковий касовий ордер',
      menu: 'Прибутковий касовий ордер',
    },
    navigation: { hostPathname: '/sad/all', kind: 'embedded' },
    payloadOperationTypes: [],
    registerTypes: ANY_REGISTER,
    semantic: 'external-document-income',
    variant: 'sad',
  },
  {
    counterparty: {
      kinds: ['client', 'organization-client'],
      required: true,
      source: 'document',
    },
    direction: 'outcome',
    endpoint: '/payments/orders/outcome/new/sad',
    id: ACCOUNTING_OPERATION_ID.SadOutcome,
    labels: {
      form: 'Видатковий ордер із САД',
      list: 'Видатковий ордер',
      menu: 'Видатковий ордер',
    },
    navigation: { hostPathname: '/sad/all', kind: 'embedded' },
    payloadOperationTypes: [],
    registerTypes: ANY_REGISTER,
    semantic: 'external-document-outcome',
    variant: 'sad',
  },
  {
    counterparty: { kinds: ['client'], required: true, source: 'document' },
    direction: 'income',
    endpoint: '/payments/orders/income/new/taxfree',
    id: ACCOUNTING_OPERATION_ID.TaxFreeIncome,
    labels: {
      form: 'Прибутковий касовий ордер із Tax Free',
      list: 'Прибутковий касовий ордер',
      menu: 'Прибутковий касовий ордер',
    },
    navigation: { hostPathname: '/tax-free/all', kind: 'embedded' },
    payloadOperationTypes: [],
    registerTypes: [ACCOUNTING_PAYMENT_REGISTER_TYPE.Cash],
    semantic: 'external-document-income',
    variant: 'tax-free',
  },
  {
    counterparty: { kinds: ['client'], required: true, source: 'document' },
    direction: 'outcome',
    endpoint: '/payments/orders/outcome/new/taxfree',
    id: ACCOUNTING_OPERATION_ID.TaxFreeOutcome,
    labels: {
      form: 'Видатковий ордер із Tax Free',
      list: 'Видатковий ордер',
      menu: 'Видатковий ордер',
    },
    navigation: { hostPathname: '/tax-free/all', kind: 'embedded' },
    payloadOperationTypes: [],
    registerTypes: ANY_REGISTER,
    semantic: 'external-document-outcome',
    variant: 'tax-free',
  },
] as const

const OPERATIONS_BY_ID = new Map<AccountingOperationId, AccountingOperationDefinition>(
  ACCOUNTING_OPERATION_CATALOG.map((operation) => [operation.id, operation]),
)

export function getAccountingOperation(id: AccountingOperationId): AccountingOperationDefinition {
  const operation = OPERATIONS_BY_ID.get(id)

  if (!operation) {
    throw new Error(`Unknown accounting operation: ${id}`)
  }

  return operation
}

export function getAccountingOperationByPayloadType(
  direction: Extract<AccountingOperationDirection, 'income' | 'outcome'>,
  payloadOperationType: number,
): AccountingOperationDefinition | null {
  return ACCOUNTING_OPERATION_CATALOG.find(
    (operation) =>
      operation.direction === direction
      && !operation.canonicalOperationId
      && operation.payloadOperationTypes.includes(payloadOperationType),
  ) || null
}

export function buildAccountingOperationPath(
  id: AccountingOperationId,
  registerType?: AccountingPaymentRegisterType,
): string {
  const operation = getAccountingOperation(id)

  if (operation.navigation.kind === 'embedded') {
    return operation.navigation.hostPathname
  }

  const query = new URLSearchParams()

  if (operation.navigation.includeRegisterType) {
    const resolvedRegisterType =
      registerType != null && operation.registerTypes.includes(registerType)
        ? registerType
        : operation.registerTypes.includes(ACCOUNTING_PAYMENT_REGISTER_TYPE.Bank)
          ? ACCOUNTING_PAYMENT_REGISTER_TYPE.Bank
          : operation.registerTypes[0]

    if (resolvedRegisterType != null) {
      query.set('type', String(resolvedRegisterType))
    }
  }

  if (operation.navigation.includeOperationType) {
    const operationType = operation.payloadOperationTypes[0]

    if (operationType != null) {
      query.set('operationType', String(operationType))
    }
  }

  const search = query.toString()

  return search ? `${operation.navigation.pathname}?${search}` : operation.navigation.pathname
}

export function getAccountingOperationLabel(
  id: AccountingOperationId,
  registerType: AccountingPaymentRegisterType | undefined,
  context: keyof AccountingOperationDefinition['labels'] = 'menu',
): string {
  const operation = getAccountingOperation(id)

  if (context === 'menu') {
    if (registerType === ACCOUNTING_PAYMENT_REGISTER_TYPE.Bank && operation.labels.bankMenu) {
      return operation.labels.bankMenu
    }

    if (registerType === ACCOUNTING_PAYMENT_REGISTER_TYPE.Cash && operation.labels.cashMenu) {
      return operation.labels.cashMenu
    }
  }

  return operation.labels[context] || operation.labels.menu
}
