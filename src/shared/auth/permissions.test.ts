import { describe, expect, it } from 'vitest'
import {
  LegacyPermissionKeys,
  PermissionAliases,
  PermissionKeys,
} from './permissionKeys'
import { getEffectivePermissionKeys, hasPermission } from './permissions'
import { UserRoleType, type AuthUser } from './types'

function userWithPermissions(...permissionKeys: string[]): AuthUser {
  return {
    UserRole: {
      Permissions: permissionKeys.map((ControlId) => ({ ControlId })),
      UserRoleType: UserRoleType.SalesAnalytic,
    },
  }
}

describe('hasPermission event compatibility', () => {
  it('accepts canonical runtime keys from /permissions/me', () => {
    expect(hasPermission(
      userWithPermissions(),
      PermissionKeys.SalesUkraine.Sale.OpenDetails,
      [PermissionKeys.SalesUkraine.Sale.OpenDetails],
    )).toBe(true)
  })

  it('resolves staged legacy aliases for existing roles', () => {
    const user = userWithPermissions(LegacyPermissionKeys.SalesUkraine.Sale.Edit)

    expect(hasPermission(user, PermissionKeys.SalesUkraine.Sale.Edit)).toBe(true)
    expect(hasPermission(user, PermissionKeys.SalesUkraine.Sale.OpenCreateDialog)).toBe(true)
    expect(hasPermission(user, PermissionKeys.SalesUkraine.Sale.Create)).toBe(true)
    expect(getEffectivePermissionKeys(user)).toContain(PermissionKeys.SalesUkraine.Sale.Edit)
  })

  it('resolves every Orders Ukraine legacy key to its canonical event permission', () => {
    for (const [canonicalKey, aliases] of Object.entries(PermissionAliases)) {
      if (!canonicalKey.startsWith('orders.ukraine.')) {
        continue
      }

      expect(aliases).toHaveLength(1)
      expect(hasPermission(userWithPermissions(aliases![0]), canonicalKey, [])).toBe(true)
    }
  })

  it('resolves every Client Resources legacy key to its canonical event permission', () => {
    for (const [canonicalKey, aliases] of Object.entries(PermissionAliases)) {
      if (!canonicalKey.startsWith('counterparties.resources.')) {
        continue
      }

      expect(aliases).toHaveLength(1)
      expect(hasPermission(userWithPermissions(aliases![0]), canonicalKey, [])).toBe(true)
    }
  })

  it('resolves every Clients legacy key to its canonical event permission', () => {
    for (const [canonicalKey, aliases] of Object.entries(PermissionAliases)) {
      if (!canonicalKey.startsWith('counterparties.clients.')) {
        continue
      }

      expect(aliases).toHaveLength(1)
      expect(hasPermission(userWithPermissions(aliases![0]), canonicalKey, [])).toBe(true)
    }
  })

  it('resolves every Product Delivery Protocol legacy key to its canonical event permission', () => {
    for (const [canonicalKey, aliases] of Object.entries(PermissionAliases)) {
      if (!canonicalKey.startsWith('orders.delivery_protocol.')) {
        continue
      }

      expect(aliases).toHaveLength(1)
      expect(hasPermission(userWithPermissions(aliases![0]), canonicalKey, [])).toBe(true)
    }
  })

  it('resolves every financial-administration legacy key to its canonical event permission', () => {
    const prefixes = [
      'accounting.cashflow_articles.',
      'payments.banks.',
      'payments.currency_convertors.',
      'payments.payment_accounts.',
    ]

    for (const [canonicalKey, aliases] of Object.entries(PermissionAliases)) {
      if (!prefixes.some((prefix) => canonicalKey.startsWith(prefix))) {
        continue
      }

      expect(aliases).toHaveLength(1)
      expect(hasPermission(userWithPermissions(aliases![0]), canonicalKey, [])).toBe(true)
    }
  })

  it('resolves every Supplier Organizations and Providing Service Acts legacy action', () => {
    const prefixes = [
      'services.supplier_organizations.',
      'services.providing_service_acts.',
    ]

    for (const [canonicalKey, aliases] of Object.entries(PermissionAliases)) {
      if (!prefixes.some((prefix) => canonicalKey.startsWith(prefix))) {
        continue
      }

      expect(aliases).toHaveLength(1)
      expect(hasPermission(userWithPermissions(aliases![0]), canonicalKey, [])).toBe(true)
    }
  })

  it('preserves formerly unguarded events only while /permissions/me is unavailable', () => {
    const user = userWithPermissions()

    expect(hasPermission(user, PermissionKeys.SalesUkraine.Sale.OpenDetails, null)).toBe(true)
    expect(hasPermission(user, PermissionKeys.SalesUkraine.Sale.OpenDetails, [])).toBe(false)
  })

  it('does not grant an aliased mutation when neither canonical nor legacy key exists', () => {
    expect(hasPermission(
      userWithPermissions(),
      PermissionKeys.SalesUkraine.Sale.Unlock,
      null,
    )).toBe(false)
  })

  it('keeps the existing elevated-role bypass', () => {
    const user: AuthUser = { UserRole: { UserRoleType: UserRoleType.Administrator } }

    expect(hasPermission(user, PermissionKeys.SalesUkraine.Sale.Delete, [])).toBe(true)
  })
})
