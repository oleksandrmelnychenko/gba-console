import { describe, expect, it } from 'vitest'
import { PermissionKeys } from './permissionKeys'
import { getEffectivePermissionKeys, hasPermission } from './permissions'

describe('canonical event permission runtime', () => {
  const canonical = PermissionKeys.SalesUkraine.Sale.Edit
  const legacy = 'UkraineAllActOfEdit_Change_PKEY'

  it('accepts an exact canonical key returned by /permissions/me', () => {
    expect(hasPermission(canonical, [canonical])).toBe(true)
  })

  it('fails closed when /permissions/me is unavailable or empty', () => {
    expect(hasPermission(canonical, null)).toBe(false)
    expect(hasPermission(canonical, [])).toBe(false)
    expect(getEffectivePermissionKeys(null)).toEqual([])
  })

  it('filters legacy, unknown, and duplicate values from runtime state', () => {
    expect(getEffectivePermissionKeys([
      legacy,
      canonical,
      canonical,
      'unknown.permission',
    ])).toEqual([canonical])
  })

  it('never accepts a legacy ControlId as an authorization key', () => {
    expect(hasPermission(canonical, [legacy])).toBe(false)
    expect(hasPermission(legacy, [legacy])).toBe(false)
  })

  it('rejects empty and unknown permission checks', () => {
    expect(hasPermission('', [canonical])).toBe(false)
    expect(hasPermission('unknown.permission', ['unknown.permission'])).toBe(false)
  })
})
