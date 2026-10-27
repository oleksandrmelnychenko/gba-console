import type { AccountingCashFlow, AccountingCashFlowHeadItem } from './types'

export const INCOME_PAYMENT_ORDER_TYPE = 12

export const ADVANCE_LABEL = 'Аванс'

export const EURO_STATEMENT_NOTE = 'Суми в EUR — збережені суми документів; «Аванс» — неоплачений залишок оплати'

export const AGREEMENT_STATEMENT_NOTE = '«Аванс» — неоплачений залишок оплати'

export function getCashFlowAdvanceAmount(item: AccountingCashFlowHeadItem | null | undefined): number | null {
  if (!item || item.Type !== INCOME_PAYMENT_ORDER_TYPE) {
    return null
  }

  const value = item.AdvanceAmount

  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

export function getEstimatedEuroNote(cashFlow: AccountingCashFlow | null | undefined): string | null {
  const count = cashFlow?.EstimatedEuroDocuments

  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) {
    return null
  }

  return `Документів без збереженої суми EUR: ${count}; їх оцінено за поточним курсом`
}

export function getCashFlowStatementNotes(params: {
  cashFlow: AccountingCashFlow | null | undefined
  hasAgreement: boolean
  mode: string
}): string[] {
  if (params.mode !== 'client') {
    return []
  }

  if (params.hasAgreement) {
    return [AGREEMENT_STATEMENT_NOTE]
  }

  const estimated = getEstimatedEuroNote(params.cashFlow)

  return estimated ? [EURO_STATEMENT_NOTE, estimated] : [EURO_STATEMENT_NOTE]
}
