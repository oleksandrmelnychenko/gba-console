import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiRequest = vi.hoisted(() => vi.fn())

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest }))

import { getCurrentUserProfile } from './authApi'

describe('getCurrentUserProfile', () => {
  beforeEach(() => {
    apiRequest.mockReset()
  })

  it('loads the authenticated user without requiring permission to inspect other users', async () => {
    apiRequest.mockResolvedValue({ NetUid: 'current-user' })

    await expect(getCurrentUserProfile({
      csrfToken: 'csrf-token',
      userNetUid: 'current-user',
    })).resolves.toEqual({ NetUid: 'current-user' })

    expect(apiRequest).toHaveBeenCalledWith('/usermanagement/profiles/me')
  })

  it('does not request a profile when the authenticated session has no user id', async () => {
    await expect(getCurrentUserProfile({ csrfToken: 'csrf-token' })).resolves.toBeNull()

    expect(apiRequest).not.toHaveBeenCalled()
  })
})
