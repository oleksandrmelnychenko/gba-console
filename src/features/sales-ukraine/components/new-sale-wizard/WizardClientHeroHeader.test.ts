import { describe, expect, it } from 'vitest'
import type { ClientIdentityAttentionSummary } from '../../../clients/types'
import { getLegalPartyRiskLabel } from './wizardLegalPartyRisk'

const translate = (value: string) => value

function createRisk(
  overrides: Partial<ClientIdentityAttentionSummary>,
): ClientIdentityAttentionSummary {
  return {
    ClientNetUid: 'client-1',
    AsOfUtc: '2026-07-28T10:00:00Z',
    AttentionLevel: 'warning',
    LegalCodeQuality: 'plausible',
    NormalizedLegalCode: '01268489',
    RequiresReview: true,
    BlocksSale: false,
    HasOverdueDebt: false,
    HasOwnOverdueDebt: false,
    HasRelatedOverdueDebt: false,
    IsTargetBlocked: false,
    HasRelatedBlockedCard: false,
    MaxOverdueDays: 0,
    RelatedCardCount: 2,
    BuyerCardCount: 2,
    AttentionReasons: [],
    Candidates: [],
    OverdueByCurrency: [],
    ...overrides,
  }
}

describe('wizard legal-party risk label', () => {
  it('prioritizes legal-party overdue age over a generic duplicate warning', () => {
    expect(
      getLegalPartyRiskLabel(
        createRisk({
          HasOverdueDebt: true,
          HasRelatedOverdueDebt: true,
          MaxOverdueDays: 1519,
        }),
        translate,
      ),
    ).toBe('Прострочення в іншій картці · 1519 дн.')
  })

  it('shows the number of linked client cards when there is no harder risk', () => {
    expect(
      getLegalPartyRiskLabel(
        createRisk({ RelatedCardCount: 4, RequiresReview: false }),
        translate,
      ),
    ).toBe('Пов’язані картки · 4')
  })
})
