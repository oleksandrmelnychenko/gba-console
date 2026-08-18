import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiRequest = vi.hoisted(() => vi.fn())

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest }))

import { getMyPermissions } from './permissionsApi'

describe('getMyPermissions', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('loads the agreed /permissions/me contract and normalizes duplicate keys', async () => {
    apiRequest.mockResolvedValue({
      catalogVersion: '2026.08.17.1',
      permissionKeys: [
        'sales.ukraine.sale.view',
        ' sales.ukraine.sale.edit ',
        'sales.ukraine.sale.view',
        null,
      ],
    })

    await expect(getMyPermissions()).resolves.toEqual({
      catalogVersion: '2026.08.17.1',
      permissionKeys: [
        'sales.ukraine.sale.view',
        'sales.ukraine.sale.edit',
      ],
    })
    expect(apiRequest).toHaveBeenCalledWith('/permissions/me')
  })

  it('treats a successful malformed key list as an explicit empty grant', async () => {
    apiRequest.mockResolvedValue({ permissionKeys: null })

    await expect(getMyPermissions()).resolves.toEqual({
      catalogVersion: null,
      permissionKeys: [],
    })
  })
})
