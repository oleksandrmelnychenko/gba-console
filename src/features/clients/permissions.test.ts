import { describe, expect, it } from 'vitest'
import { PermissionKeys } from '../../shared/auth/permissionKeys'
import { getClientTypePermission, getClientTypeRolePermission } from './permissions'

describe('client permission mapping', () => {
  it('maps known client types and roles to canonical keys', () => {
    expect(getClientTypePermission('supplier_icon')).toBe(PermissionKeys.Clients.ClientType.SelectSupplier)
    expect(getClientTypePermission('client_icon')).toBe(PermissionKeys.Clients.ClientType.SelectBuyer)
    expect(getClientTypeRolePermission('Постачальники товару')).toBe(
      PermissionKeys.Clients.ClientType.SelectProductSupplier,
    )
    expect(getClientTypeRolePermission('Покупці Україна')).toBe(
      PermissionKeys.Clients.ClientType.SelectUkraineBuyer,
    )
    expect(getClientTypeRolePermission('ShopClient')).toBe(
      PermissionKeys.Clients.ClientType.SelectShopClient,
    )
  })

  it('fails closed for unknown database values instead of inventing legacy PKEYs', () => {
    expect(getClientTypePermission('custom_icon')).toBe('')
    expect(getClientTypeRolePermission('Custom role')).toBe('')
  })
})
