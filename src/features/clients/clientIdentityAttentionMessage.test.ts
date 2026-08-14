import { describe, expect, it } from 'vitest'
import type { ClientIdentityAttentionSummary } from './types'
import {
  getClientIdentityAttentionMessage,
  getClientIdentityAttentionTitle,
} from './clientIdentityAttentionMessage'

const t = (value: string) => value

function createAttention(
  overrides: Partial<ClientIdentityAttentionSummary> = {},
): ClientIdentityAttentionSummary {
  return {
    ClientNetUid: 'client-1',
    AsOfUtc: '2026-08-14T10:00:00Z',
    AttentionLevel: 'warning',
    LegalCodeQuality: 'plausible',
    RequiresReview: false,
    HasCreditRiskSignal: false,
    HasOverdueDebt: false,
    HasOwnOverdueDebt: false,
    HasRelatedOverdueDebt: false,
    IsTargetBlocked: false,
    HasRelatedBlockedCard: false,
    MaxOverdueDays: 0,
    OwnMaxOverdueDays: 0,
    RelatedMaxOverdueDays: 0,
    RelatedCardCount: 0,
    BuyerCardCount: 1,
    AttentionReasons: [],
    Candidates: [],
    OverdueByCurrency: [],
    ...overrides,
  }
}

describe('client identity attention message', () => {
  it('explains an own overdue debt without asking to recheck valid legal details', () => {
    const message = getClientIdentityAttentionMessage(
      createAttention({
        HasCreditRiskSignal: true,
        HasOverdueDebt: true,
        HasOwnOverdueDebt: true,
        MaxOverdueDays: 1,
        OwnMaxOverdueDays: 1,
      }),
      t,
    )

    expect(message).toContain('простроченої заборгованості')
    expect(message).toContain('Платоспроможність')
    expect(message).not.toContain('Перевірте ЄДРПОУ')
  })

  it('keeps a separate legal-code warning when debt and invalid details coexist', () => {
    const message = getClientIdentityAttentionMessage(
      createAttention({
        HasOverdueDebt: true,
        HasOwnOverdueDebt: true,
        LegalCodeQuality: 'invalid',
      }),
      t,
    )

    expect(message).toContain('заборгованості')
    expect(message).toContain('Окремо перевірте ЄДРПОУ / ІПН')
  })

  it('points related debt to the client structure', () => {
    const message = getClientIdentityAttentionMessage(
      createAttention({
        HasOverdueDebt: true,
        HasRelatedOverdueDebt: true,
        MaxOverdueDays: 54,
        RelatedMaxOverdueDays: 54,
      }),
      t,
    )

    expect(message).toContain('іншій картці')
    expect(message).toContain('Структура клієнта')
  })

  it('keeps own debt primary when the structure also has related debt', () => {
    const attention = createAttention({
      HasCreditRiskSignal: true,
      HasOverdueDebt: true,
      HasOwnOverdueDebt: true,
      HasRelatedOverdueDebt: true,
      MaxOverdueDays: 54,
      OwnMaxOverdueDays: 1,
      RelatedMaxOverdueDays: 54,
    })

    expect(getClientIdentityAttentionTitle(attention, t)).toBe(
      'Є прострочений борг · 1 дн.',
    )
    expect(getClientIdentityAttentionMessage(attention, t)).toContain(
      'В іншій картці структури також є прострочення.',
    )
  })
})
