import { describe, expect, it } from 'vitest'
import {
  AGREEMENT_STATEMENT_NOTE,
  EURO_STATEMENT_NOTE,
  getCashFlowAdvanceAmount,
  getCashFlowStatementNotes,
  getEstimatedEuroNote,
} from './cashFlowAdvance'

describe('cash flow advance presentation', () => {
  it('reports only a positive advance on an income payment row', () => {
    expect(getCashFlowAdvanceAmount({ Type: 12, AdvanceAmount: 40 })).toBe(40)
    expect(getCashFlowAdvanceAmount({ Type: 12, AdvanceAmount: 0 })).toBeNull()
    expect(getCashFlowAdvanceAmount({ Type: 12 })).toBeNull()
    expect(getCashFlowAdvanceAmount({ Type: 13, AdvanceAmount: 40 })).toBeNull()
    expect(getCashFlowAdvanceAmount(null)).toBeNull()
  })

  it('explains stored EUR and advances on the whole-client statement', () => {
    expect(getCashFlowStatementNotes({ cashFlow: { AccountingCashFlowHeadItems: [] }, hasAgreement: false, mode: 'client' })).toEqual([EURO_STATEMENT_NOTE])
    expect(getCashFlowStatementNotes({ cashFlow: { AccountingCashFlowHeadItems: [], EstimatedEuroDocuments: 2 }, hasAgreement: false, mode: 'client' })).toEqual([
      EURO_STATEMENT_NOTE,
      'Документів без збереженої суми EUR: 2; їх оцінено за поточним курсом',
    ])
    expect(EURO_STATEMENT_NOTE).toBe('Суми в EUR — збережені суми документів; «Аванс» — неоплачений залишок оплати')
  })

  it('keeps the agreement-currency statement free of the EUR note', () => {
    expect(getCashFlowStatementNotes({ cashFlow: { AccountingCashFlowHeadItems: [], EstimatedEuroDocuments: 2 }, hasAgreement: true, mode: 'client' })).toEqual([
      AGREEMENT_STATEMENT_NOTE,
    ])
    expect(getCashFlowStatementNotes({ cashFlow: { AccountingCashFlowHeadItems: [] }, hasAgreement: false, mode: 'supplier' })).toEqual([])
  })

  it('omits the estimate note without estimated documents', () => {
    expect(getEstimatedEuroNote({ AccountingCashFlowHeadItems: [], EstimatedEuroDocuments: 0 })).toBeNull()
    expect(getEstimatedEuroNote(null)).toBeNull()
  })
})
