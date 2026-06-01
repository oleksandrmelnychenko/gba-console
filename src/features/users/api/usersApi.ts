import { apiRequest } from '../../../shared/api/apiClient'
import type { DashboardNodeModule, IdentityResponse, UserPermission, UserProfile, UserRole } from '../types'

export async function getUsers(value?: string, signal?: AbortSignal): Promise<UserProfile[]> {
  const normalizedValue = value?.trim()
  const path = normalizedValue ? '/usermanagement/profiles/search' : '/usermanagement/profiles/all'
  const options = normalizedValue
    ? {
        query: {
          value: normalizedValue,
        },
        ...(signal ? { signal } : {}),
      }
    : signal
      ? { signal }
      : undefined
  const result = await apiRequest<unknown>(
    path,
    options,
  )

  return normalizeUsers(result)
}

export async function getUser(netId: string): Promise<UserProfile | null> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/get', {
    query: {
      netId,
    },
  })

  return normalizeUser(result)
}

export async function createUser(user: UserProfile, password: string): Promise<IdentityResponse | null> {
  const result = await apiRequest<unknown>('/usermanagement/signup', {
    method: 'POST',
    query: {
      password,
    },
    body: user,
  })

  return normalizeIdentityResponse(result)
}

export async function updateUser(user: UserProfile): Promise<UserProfile | null> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/update', {
    method: 'POST',
    body: user,
  })

  return normalizeUser(result)
}

export async function deleteUser(netId: string): Promise<void> {
  await apiRequest<unknown>('/usermanagement/profiles/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function resetUserPassword(netId: string, password: string): Promise<IdentityResponse | null> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/password/reset', {
    method: 'PATCH',
    query: {
      netId,
      password,
    },
  })

  return normalizeIdentityResponse(result)
}

export async function getUserRoles(): Promise<UserRole[]> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/roles/all')

  return normalizeUserRoles(result)
}

export async function createUserRole(role: UserRole): Promise<UserRole | null> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/roles/new', {
    method: 'POST',
    body: role,
  })

  return normalizeRole(result)
}

export async function updateUserRole(role: UserRole): Promise<UserRole | null> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/roles/update', {
    method: 'POST',
    body: role,
  })

  return normalizeRole(result)
}

export async function deleteUserRole(netId: string): Promise<void> {
  await apiRequest<unknown>('/usermanagement/profiles/roles/delete', {
    method: 'DELETE',
    query: {
      netId,
    },
  })
}

export async function getDashboardModules(): Promise<DashboardNodeModule[]> {
  const result = await apiRequest<unknown>('/dashboards/modules/all')

  return normalizeModules(result)
}

export async function changePermissionsToRole(role: UserRole): Promise<UserRole | null> {
  const result = await apiRequest<unknown>('/usermanagement/profiles/roles/add/nodes', {
    method: 'POST',
    body: role,
  })

  return normalizeRole(result)
}

export async function addPermissionToNode(permission: UserPermission, image?: File | null): Promise<void> {
  await apiRequest<unknown>('/permissions/new', {
    method: 'POST',
    body: buildPermissionFormData(permission, image),
  })
}

export async function updatePermissionToNode(permission: UserPermission, image?: File | null): Promise<void> {
  await apiRequest<unknown>('/permissions/update', {
    method: 'POST',
    body: buildPermissionFormData(permission, image),
  })
}

function buildPermissionFormData(permission: UserPermission, image?: File | null): FormData {
  const formData = new FormData()
  formData.append('image', image || '')
  formData.append('permission', JSON.stringify(permission))

  return formData
}

function normalizeUsers(result: unknown): UserProfile[] {
  if (Array.isArray(result)) {
    return result as UserProfile[]
  }

  if (result && typeof result === 'object' && 'Items' in result && Array.isArray(result.Items)) {
    return result.Items as UserProfile[]
  }

  return []
}

function normalizeUser(result: unknown): UserProfile | null {
  if (result && typeof result === 'object') {
    return result as UserProfile
  }

  return null
}

function normalizeUserRoles(result: unknown): UserRole[] {
  if (Array.isArray(result)) {
    return result as UserRole[]
  }

  if (result && typeof result === 'object' && 'Items' in result && Array.isArray(result.Items)) {
    return result.Items as UserRole[]
  }

  return []
}

function normalizeIdentityResponse(result: unknown): IdentityResponse | null {
  if (result && typeof result === 'object') {
    return result as IdentityResponse
  }

  return null
}

function normalizeRole(result: unknown): UserRole | null {
  if (result && typeof result === 'object') {
    return result as UserRole
  }

  return null
}

function normalizeModules(result: unknown): DashboardNodeModule[] {
  if (Array.isArray(result)) {
    return result as DashboardNodeModule[]
  }

  if (result && typeof result === 'object' && 'Items' in result && Array.isArray(result.Items)) {
    return result.Items as DashboardNodeModule[]
  }

  return []
}
