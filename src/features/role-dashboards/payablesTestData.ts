import type { PayablesRows, PayablesSnapshot, PayablesWorld } from './payablesTypes'

export function payablesWorld(overrides: Partial<PayablesWorld> = {}): PayablesWorld {
  return {
    world: 'fenix', status: 'confirmed', reason: null,
    publicationId: 'a0000000-0000-0000-0000-000000000001',
    sourceCutoffUtc: '2026-10-23T00:00:00Z', capturedAtUtc: '2026-10-23T00:01:00Z', publishedAtUtc: '2026-10-23T00:02:00Z',
    scopeComplete: true, scope: 'Зареєстровані договори постачальників', requestedKeys: 2, returnedKeys: 2, excludedKeys: 0,
    buckets: [{ currencyCode: 'USD', currencyLabel: 'USD', rowCount: 2, signedBalance: -80, payable: 100, advance: 20 }],
    ...overrides,
  }
}

export function payablesSnapshot(): PayablesSnapshot {
  return { readAtUtc: '2026-10-23T00:03:00Z', worlds: [payablesWorld(), payablesWorld({ world: 'amg', status: 'unavailable', reason: 'Валюту боргу не підтверджено', publicationId: null, sourceCutoffUtc: null, capturedAtUtc: null, publishedAtUtc: null, scopeComplete: false, requestedKeys: null, returnedKeys: null, buckets: [] })] }
}

export function payablesRows(): PayablesRows {
  const world = payablesWorld()
  return {
    world: 'fenix', publicationId: world.publicationId!, currencyCode: 'USD', sourceCutoffUtc: world.sourceCutoffUtc!, offset: 0, limit: 50, total: 2,
    aggregate: { signedBalance: -80, payable: 100, advance: 20 },
    rows: [
      { id: 'one', partyKind: 1, supplierCode: 'S-1', supplierName: 'Постачальник один', agreementId: 'agreement-one', agreementName: 'Договір один', organizationName: 'Fenix', signedBalance: -100, payable: 100, advance: 0 },
      { id: 'two', partyKind: 1, supplierCode: 'S-2', supplierName: 'Постачальник два', agreementId: 'agreement-two', agreementName: 'Договір два', organizationName: 'Fenix', signedBalance: 20, payable: 0, advance: 20 },
    ],
  }
}
