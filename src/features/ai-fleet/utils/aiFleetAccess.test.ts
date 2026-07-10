import { describe, expect, it } from 'vitest'
import { UserRoleType } from '../../../shared/auth/types'
import { canRunAiFleetWarmup } from './aiFleetAccess'

describe('canRunAiFleetWarmup', () => {
  it.each([UserRoleType.Administrator, UserRoleType.GBA])('allows privileged role %s', (role) => {
    expect(canRunAiFleetWarmup({ UserRole: { UserRoleType: role } })).toBe(true)
  })

  it('rejects regular and missing users', () => {
    expect(canRunAiFleetWarmup({ UserRole: { UserRoleType: UserRoleType.SalesAnalytic } })).toBe(false)
    expect(canRunAiFleetWarmup(null)).toBe(false)
  })
})
