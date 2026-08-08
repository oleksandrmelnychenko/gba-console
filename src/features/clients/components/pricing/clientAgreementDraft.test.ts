import { describe, expect, it } from 'vitest'
import { appendNewClientAgreementDraft } from './clientAgreementDraft'

describe('appendNewClientAgreementDraft', () => {
  it('does not treat a UI-only identifier as a persisted NetUid', () => {
    const temporaryNetUid = '33333333-3333-4333-8333-333333333333'
    const existing = [
      {
        Id: 10,
        NetUid: 'client-agreement-1',
        Agreement: { Id: 11, NetUid: 'agreement-1', Name: 'Persisted agreement' },
      },
    ]

    const result = appendNewClientAgreementDraft(existing, {
      Id: 0,
      Name: 'New agreement',
      NetUid: temporaryNetUid,
    })

    expect(result.agreement).toEqual({
      Id: 0,
      Name: 'New agreement',
      TempId: 1,
    })
    expect(result.clientAgreements).toEqual([
      existing[0],
      { Agreement: result.agreement },
    ])
    expect(result.clientAgreements[1]).not.toHaveProperty('NetUid')
  })

  it('assigns distinct local TempIds without changing persisted rows', () => {
    const existing = [
      { Id: 10, NetUid: 'client-agreement-1', Agreement: { Id: 11, NetUid: 'agreement-1' } },
      { Agreement: { Name: 'First draft', TempId: 4 } },
    ]

    const first = appendNewClientAgreementDraft(existing, { Name: 'Second draft' })
    const second = appendNewClientAgreementDraft(first.clientAgreements, { Name: 'Third draft' })

    expect(first.agreement.TempId).toBe(5)
    expect(second.agreement.TempId).toBe(6)
    expect(second.clientAgreements[0]).toBe(existing[0])
    expect(second.clientAgreements[1]).toBe(existing[1])
  })
})
