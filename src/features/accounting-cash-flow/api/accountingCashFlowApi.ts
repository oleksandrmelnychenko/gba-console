import { apiRequest } from '../../../shared/api/apiClient'
import type {
  AccountingCashFlow,
  AccountingCashFlowCounterparty,
  AccountingCashFlowDocument,
  AccountingCashFlowExportParams,
  AccountingCashFlowHeadItem,
  AccountingCashFlowSearchParams,
} from '../types'

const ACCOUNTING_TYPE_ALL = 2

export async function getAccountingCashFlowCounterparty(netId: string): Promise<AccountingCashFlowCounterparty | null> {
  const result = await apiRequest<unknown>('/clients/get', {
    query: {
      netId,
    },
  })

  return normalizeCounterparty(result)
}

export async function getAccountingCashFlow(params: AccountingCashFlowSearchParams): Promise<AccountingCashFlow> {
  const result = await apiRequest<unknown>('/accounting/cashflow/get/filtered', {
    query: {
      netId: params.netId,
      from: params.from,
      to: params.to,
      typePaymentTask: params.mode === 'supplier' ? ACCOUNTING_TYPE_ALL : undefined,
    },
  })

  return normalizeAccountingCashFlow(result)
}

export async function exportAccountingCashFlowDocument(
  params: AccountingCashFlowExportParams,
): Promise<AccountingCashFlowDocument> {
  const result = await apiRequest<unknown>('/accounting/cashflow/document/export', {
    query: {
      netId: params.netId,
      from: params.from,
      to: params.to,
    },
  })

  return normalizeDocument(result)
}

export async function getAccountingCashFlowSaleByNetUid(netUid: string): Promise<Record<string, unknown> | null> {
  const result = await apiRequest<unknown>('/sales/get', {
    query: {
      netId: netUid,
    },
  })

  return result && typeof result === 'object' ? (result as Record<string, unknown>) : null
}

export async function getAccountingCashFlowPaymentTaskByNetUid(netUid: string): Promise<Record<string, unknown> | null> {
  const result = await apiRequest<unknown>('/payments/tasks/get', {
    query: {
      netId: netUid,
    },
  })

  return result && typeof result === 'object' ? (result as Record<string, unknown>) : null
}

function normalizeCounterparty(result: unknown): AccountingCashFlowCounterparty | null {
  if (!result || typeof result !== 'object') {
    return null
  }

  const counterparty = result as AccountingCashFlowCounterparty

  return {
    ...counterparty,
    ClientAgreements: Array.isArray(counterparty.ClientAgreements) ? counterparty.ClientAgreements : [],
  }
}

function normalizeAccountingCashFlow(result: unknown): AccountingCashFlow {
  const payload = result && typeof result === 'object' ? (result as Partial<AccountingCashFlow>) : {}
  const items = Array.isArray(payload.AccountingCashFlowHeadItems)
    ? payload.AccountingCashFlowHeadItems
    : []

  return {
    ...payload,
    AccountingCashFlowHeadItems: items.map(normalizeHeadItem),
  }
}

function normalizeHeadItem(item: unknown): AccountingCashFlowHeadItem {
  if (!item || typeof item !== 'object') {
    return {}
  }

  return item as AccountingCashFlowHeadItem
}

function normalizeDocument(result: unknown): AccountingCashFlowDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL: typeof payload.PdfDocumentURL === 'string' ? payload.PdfDocumentURL : '',
  }
}
