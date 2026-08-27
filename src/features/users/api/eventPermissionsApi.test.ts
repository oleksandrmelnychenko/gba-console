import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  getEventPermissionCatalog,
  getRoleEventPermissions,
  updateRoleEventPermissions,
} from './eventPermissionsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const mockedApiRequest = vi.mocked(apiRequest)

describe('eventPermissionsApi', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset()
  })

  it('loads and normalizes the event catalog contract', async () => {
    mockedApiRequest.mockResolvedValue({
      catalogVersion: '2026.08.17.1',
      permissions: [
        {
          active: true,
          controlType: 'mutation',
          groupId: 'sale-actions',
          groupLabel: 'Дії з продажем',
          key: 'sales.ukraine.sale.edit',
          name: 'Редагувати продаж',
          pageId: 'sales.ukraine.all',
          pageLabel: 'Усі продажі України',
          risk: 'high',
          route: '/sales/ukraine/all',
          sectionId: 'sales',
          sectionLabel: 'Продажі',
        },
      ],
    })

    const result = await getEventPermissionCatalog()

    expect(mockedApiRequest).toHaveBeenCalledWith('/permissions/catalog', {
      query: { kind: 'event' },
    })
    expect(result.catalogVersion).toBe('2026.08.17.1')
    expect(result.permissions[0]).toMatchObject({
      key: 'sales.ukraine.sale.edit',
      risk: 'high',
      sectionLabel: 'Продажі',
    })
  })

  it('loads a role permission snapshot from an encoded role route', async () => {
    mockedApiRequest.mockResolvedValue({
      catalogVersion: '1',
      inheritedPermissionKeys: ['sales.ukraine.sale.edit'],
      permissionKeys: ['sales.ukraine.sale.view'],
      roleNetUid: 'role/id',
      version: 4,
    })

    await expect(getRoleEventPermissions('role/id')).resolves.toEqual({
      catalogVersion: '1',
      inheritedPermissionKeys: ['sales.ukraine.sale.edit'],
      permissionKeys: ['sales.ukraine.sale.view'],
      roleNetUid: 'role/id',
      updatedAt: undefined,
      updatedBy: undefined,
      version: 4,
    })
    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/usermanagement/profiles/roles/role%2Fid/event-permissions',
      undefined,
    )
  })

  it('sends expectedVersion and permission keys in the dedicated PUT', async () => {
    mockedApiRequest.mockResolvedValue({
      catalogVersion: '1',
      permissionKeys: ['a', 'b'],
      roleNetUid: 'role-1',
      version: 8,
    })

    const saved = await updateRoleEventPermissions('role-1', 7, ['a', 'b'])

    expect(mockedApiRequest).toHaveBeenCalledWith(
      '/usermanagement/profiles/roles/role-1/event-permissions',
      {
        method: 'PUT',
        body: {
          expectedVersion: 7,
          permissionKeys: ['a', 'b'],
        },
      },
    )
    expect(saved.version).toBe(8)
  })
})
