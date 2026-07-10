import type { AuthUser } from '../../../shared/auth/types'
import { UserRoleType } from '../../../shared/auth/types'

export function canRunAiFleetWarmup(user: AuthUser | null | undefined): boolean {
  const role = user?.UserRole?.UserRoleType
  return role === UserRoleType.Administrator || role === UserRoleType.GBA
}
