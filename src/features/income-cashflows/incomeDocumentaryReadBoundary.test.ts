import { describe, expect, it } from 'vitest'
import { documentaryOverlayFixture } from '../../shared/debt/documentaryDebtAging.test-fixtures'
import { paymentAgreementWithoutDocumentaryRead, paymentClientWithoutDocumentaryRead } from './incomeDocumentaryReadBoundary'
import { attachIncomeCounterpartyToOrder } from './incomeCashflowCounterpartyContract'
import { resolveIncomeCashflowPaymentTargets } from './incomeCashflowDebtTargets'

describe('documentary read metadata never changes payment writes', () => {
  const overlay = documentaryOverlayFixture()
  const debt = { Id: 21, Debt: { Id: 41, Days: 90, Total: 100 }, SaleId: 31 }
  const agreement = { Id: 17, AgreementId: 9, CurrentAmount: 23, DocumentaryDebtAging: overlay }
  const client = { Id: 7, DocumentaryDebtAging: overlay, ClientAgreements: [agreement], ClientInDebts: [debt] }
  it('strips only read metadata from client/agreements without modifying business values', () => {
    expect(paymentAgreementWithoutDocumentaryRead(agreement)).toEqual({ Id: 17, AgreementId: 9, CurrentAmount: 23 })
    expect(paymentClientWithoutDocumentaryRead(client)).toEqual({ Id: 7, ClientAgreements: [{ Id: 17, AgreementId: 9, CurrentAmount: 23 }], ClientInDebts: [debt] })
    expect(client.DocumentaryDebtAging).toBe(overlay)
    expect(agreement.DocumentaryDebtAging).toBe(overlay)
  })
  it('retains chosen debt identities/amounts and omits both read roots in actual request builder', () => {
    const targets = resolveIncomeCashflowPaymentTargets({ autoAllocate: false, debts: [debt], selectedDebtValues: ['21'], paymentAmountInDebtCurrency: 100 })
    const payload = attachIncomeCounterpartyToOrder({ Amount: 100 }, {
      counterpartyPayloadKind: 'client', selectedClient: client, selectedClientAgreement: agreement,
      selectedClientDebts: targets.clientDebts, selectedSupplyAgreement: null, selectedSupplyOrganization: null,
    })
    expect(targets.saleTargets).toEqual([{ SaleId: 31 }])
    expect(payload.Client?.ClientInDebts).toEqual([debt])
    expect(payload.Amount).toBe(100)
    expect(JSON.stringify(payload)).not.toContain('DocumentaryDebtAging')
    expect(client.DocumentaryDebtAging).toBe(overlay)
  })
})
