import { describe, expect, it } from 'vitest'
import { formatGroupedDebtorMoney, GROUPED_DEBTOR_ROOT,
  readGroupedDebtorCapability, readGroupedDebtorStatement } from './groupedDebtor'

const uid = '00000000-0000-0000-0000-000000000001'
const row = {
  OrganizationId: '9007199254740993', OrganizationNetUid: uid, OrganizationName: 'Компанія',
  CounterpartyId: '20', CounterpartyNetUid: uid, CounterpartyName: 'Покупець',
  CurrencyId: '40', CurrencyNetUid: uid, CurrencyCode: '980',
  Opening: '100.00', Incoming: '15.50', Outgoing: '5.00', Closing: '110.50',
  Agreements: [{ AgreementId: '31', AgreementNetUid: uid,
    SourceAgreementRRef: 'A'.repeat(32), PublicationId: uid }],
}

describe('grouped debtor wire contract', () => {
  it('requires the source and parity gates before treating a capability as ready', () => {
    const capability = { Available: false, SourcePopulationCertified: false,
      WorkbookParityVerified: false, BuyerRootSourceId: GROUPED_DEBTOR_ROOT,
      MaximumDays: 31, CurrencyBasis: 'SettlementCurrency', Reason: 'Покриття не завершено' }
    expect(readGroupedDebtorCapability(capability)?.Available).toBe(false)
    expect(readGroupedDebtorCapability({ ...capability, Available: true })).toBeNull()
    expect(readGroupedDebtorCapability({ ...capability, BuyerRootSourceId: '0'.repeat(32) })).toBeNull()
  })

  it('keeps exact IDs and cents as strings and refuses a wrong total or duplicate group', () => {
    const statement = { From: '2025-09-01', To: '2025-09-02', BuyerRootSourceId: GROUPED_DEBTOR_ROOT,
      CurrencyBasis: 'SettlementCurrency', Rows: [row] }
    expect(readGroupedDebtorStatement(statement, statement.From, statement.To)?.Rows[0].OrganizationId)
      .toBe('9007199254740993')
    expect(formatGroupedDebtorMoney('-1234.5')).toBe('−1 234,50')
    expect(readGroupedDebtorStatement({ ...statement, Rows: [{ ...row, Closing: '111.50' }] },
      statement.From, statement.To)).toBeNull()
    expect(readGroupedDebtorStatement({ ...statement, Rows: [row, row] },
      statement.From, statement.To)).toBeNull()
    expect(readGroupedDebtorStatement({ ...statement, Rows: [{ ...row, CurrencyCode: '978' }] },
      statement.From, statement.To)?.Rows[0].CurrencyCode).toBe('978')
  })
})
