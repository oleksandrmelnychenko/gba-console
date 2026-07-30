import { describe, expect, it } from 'vitest'
import type { ClientLegalPartySalesRiskSummary } from '../../../clients/types'
import { getLegalPartyRiskLabel } from './wizardLegalPartyRisk'

const translate = (value: string) => value

function createRisk(
  overrides: Partial<ClientLegalPartySalesRiskSummary>,
): ClientLegalPartySalesRiskSummary {
  return {
    AsOfUtc: '2026-07-28T10:00:00Z',
    HasLegalIdentity: true,
    NormalizedUsreou: '01268489',
    DuplicateClientCount: 2,
    HasDuplicates: true,
    HasBlockedClient: false,
    HasOverdueDebt: false,
    MaxOverdueDays: 0,
    Clients: [],
    OverdueByCurrency: [],
    ...overrides,
  }
}

describe('wizard legal-party risk label', () => {
  it('prioritizes legal-party overdue age over a generic duplicate warning', () => {
    expect(
      getLegalPartyRiskLabel(
        createRisk({ HasOverdueDebt: true, MaxOverdueDays: 1519 }),
        translate,
      ),
    ).toBe('Прострочено по юрособі · 1519 дн.')
  })

  it('shows the number of linked client cards when there is no harder risk', () => {
    expect(
      getLegalPartyRiskLabel(
        createRisk({ DuplicateClientCount: 4 }),
        translate,
      ),
    ).toBe('Можливий дубль · 4')
  })
})
