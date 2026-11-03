import type { PayablesBucket, PayablesPartyKind, PayablesRows, PayablesSnapshot } from './payablesTypes'

export function payablesBucket(overrides: Partial<PayablesBucket> = {}): PayablesBucket {
  return { currencyCode: 'USD', rowCount: 2, goodsRowCount: 1, serviceRowCount: 1, unknownRowCount: 0, signedBalance: -80, payable: 100, advance: 20, ...overrides }
}

export function payablesSnapshot(): PayablesSnapshot {
  return { readAtUtc: '2026-11-02T10:00:00Z', asOfDate: '2026-11-02', buckets: [payablesBucket()] }
}

export function payablesRows(): PayablesRows {
  return {
    asOfDate: '2026-11-02', currencyCode: 'USD', offset: 0, limit: 50, total: 2,
    aggregate: { signedBalance: -80, payable: 100, advance: 20 },
    rows: [
      { id: '2-11', partyKind: 2, supplierNetUid: 'a0000000-0000-0000-0000-000000000011', supplierName: 'Постачальник один', agreementNetUid: 'b0000000-0000-0000-0000-000000000011', agreementName: 'Договір один', organizationName: 'Фенікс', known: true, signedBalance: -100, payable: 100, advance: 0 },
      { id: '3-12', partyKind: 3, supplierNetUid: 'a0000000-0000-0000-0000-000000000012', supplierName: 'Перевізник два', agreementNetUid: 'b0000000-0000-0000-0000-000000000012', agreementName: 'Договір два', organizationName: 'Фенікс', known: true, signedBalance: 20, payable: 0, advance: 20 },
    ],
  }
}

export function scopedPayablesRows(partyKind: PayablesPartyKind): PayablesRows {
  const amount = partyKind === 2 ? { signedBalance: -100, payable: 100, advance: 0 } : { signedBalance: 20, payable: 0, advance: 20 }
  return { ...payablesRows(), partyKind, total: 1, aggregate: amount, rows: [payablesRows().rows[partyKind === 2 ? 0 : 1]] }
}

export function scopedPayablesSnapshot(partyKind: PayablesPartyKind): PayablesSnapshot {
  return { ...payablesSnapshot(), partyKind, buckets: [payablesBucket({ ...scopedPayablesRows(partyKind).aggregate, rowCount: 1, goodsRowCount: partyKind === 2 ? 1 : 0, serviceRowCount: partyKind === 3 ? 1 : 0 })] }
}
