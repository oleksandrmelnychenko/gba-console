import { getAccountingOperationByPayloadType } from '../accounting/accountingOperationCatalog'
import type {
  IncomeCashflowRow,
  IncomePaymentOrder,
  NamedEntity,
} from './types'

export function buildIncomeCashflowRow(
  income: IncomePaymentOrder,
  index = 0,
): IncomeCashflowRow {
  return {
    amount: income.Amount,
    comment: income.Comment,
    currency: income.Currency?.Code || income.Currency?.Name,
    fromDate: income.FromDate,
    id: String(income.NetUid || income.Id || index),
    income,
    isAccounting: income.IsAccounting,
    isCanceled: income.IsCanceled,
    isManagementAccounting: income.IsManagementAccounting,
    number: income.Number,
    operationType: income.OperationTypeName?.trim() || getAccountingOperationByPayloadType(
      'income',
      Number(income.OperationType),
    )?.labels.list || 'Невідомий тип операції',
    organization: getEntityName(income.Organization),
    payer: getIncomePayerName(income),
    paymentMovement: income.PaymentMovementOperation?.PaymentMovement?.OperationName,
    paymentRegister: income.PaymentRegister?.Name,
    responsible: getEntityName(income.User),
    rootAssigned: hasIncomeDocumentStructure(income),
  }
}

function getIncomePayerName(income: IncomePaymentOrder): string | undefined {
  if (income.Client) {
    return getEntityName(income.Client)
  }

  if (income.Colleague) {
    return [income.Colleague.FirstName, income.Colleague.LastName]
      .filter(Boolean)
      .join(' ') || getEntityName(income.Colleague)
  }

  return getEntityName(income.SupplyOrganization)
}

function hasIncomeDocumentStructure(income: IncomePaymentOrder): boolean {
  return Boolean(
    (income.RootAssignedPaymentOrder && !income.RootAssignedPaymentOrder.Deleted) ||
    (income.AssignedPaymentOrders || []).some((assignedOrder) => !assignedOrder.Deleted),
  )
}

function getEntityName(entity?: NamedEntity | null): string | undefined {
  return entity?.FullName || entity?.LastName || entity?.Name || entity?.OperationName || entity?.Code
}
