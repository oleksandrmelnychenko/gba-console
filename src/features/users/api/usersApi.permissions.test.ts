import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createUser,
  createUserRole,
  deleteUser,
  deleteUserRole,
  getRoleManagementRoles,
  getUser,
  getUserRolesForCreate,
  getUserRolesForEdit,
  getUsers,
  resetUserPassword,
  updateUser,
  updateUserRole,
} from './usersApi'
import type { UserProfile, UserRole } from '../types'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const user = { NetUid: 'user-net-id' } as UserProfile

beforeEach(() => {
  vi.mocked(apiRequest).mockReset()
  vi.mocked(apiRequest).mockResolvedValue(null)
})

describe('users permission-scoped transport', () => {
  it('uses independent registry, search and details façades', async () => {
    await getUsers()
    await getUsers('anna')
    await getUser('user-net-id')

    expect(apiRequest).toHaveBeenNthCalledWith(
      1,
      '/usermanagement/profiles/users/registry',
      undefined,
    )
    expect(apiRequest).toHaveBeenNthCalledWith(
      2,
      '/usermanagement/profiles/users/search',
      { query: { value: 'anna' } },
    )
    expect(apiRequest).toHaveBeenNthCalledWith(
      3,
      '/usermanagement/profiles/users/details',
      { query: { netId: 'user-net-id' } },
    )
  })

  it('uses independent create, edit, delete and password-reset façades', async () => {
    await createUser(user, 'secret')
    await updateUser(user)
    await deleteUser('user-net-id')
    await resetUserPassword('user-net-id', 'new-secret')

    expect(apiRequest).toHaveBeenNthCalledWith(
      1,
      '/usermanagement/users/create',
      { method: 'POST', query: { password: 'secret' }, body: user },
    )
    expect(apiRequest).toHaveBeenNthCalledWith(
      2,
      '/usermanagement/profiles/users/edit',
      { method: 'POST', body: user },
    )
    expect(apiRequest).toHaveBeenNthCalledWith(
      3,
      '/usermanagement/profiles/users/delete',
      { method: 'DELETE', query: { netId: 'user-net-id' } },
    )
    expect(apiRequest).toHaveBeenNthCalledWith(
      4,
      '/usermanagement/profiles/users/password/reset',
      {
        method: 'PATCH',
        query: { netId: 'user-net-id', password: 'new-secret' },
      },
    )
  })

  it('uses canonical role-management read and role CRUD façades', async () => {
    const role = { NetUid: 'role-net-id' } as UserRole

    await getRoleManagementRoles()
    await createUserRole(role)
    await updateUserRole(role)
    await deleteUserRole('role-net-id')

    expect(vi.mocked(apiRequest).mock.calls.map(([path]) => path)).toEqual([
      '/usermanagement/profiles/roles/registry',
      '/usermanagement/profiles/roles/create',
      '/usermanagement/profiles/roles/edit',
      '/usermanagement/profiles/roles/remove',
    ])
  })

  it('uses separate exact role-option façades for user create and edit', async () => {
    await getUserRolesForCreate()
    await getUserRolesForEdit()

    expect(vi.mocked(apiRequest).mock.calls.map(([path]) => path)).toEqual([
      '/usermanagement/profiles/users/create/roles',
      '/usermanagement/profiles/users/edit/roles',
    ])
  })
})
