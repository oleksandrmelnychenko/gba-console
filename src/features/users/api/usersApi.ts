import { apiRequest } from '../../../shared/api/apiClient'
import type { IdentityResponse, UserProfile, UserRole } from '../types'

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
