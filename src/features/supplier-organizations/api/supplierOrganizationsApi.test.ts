import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getSupplyOrganizations, searchSupplyOrganizations } from './supplierOrganizationsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('supplierOrganizationsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads filtered supplier organizations through the paged search endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce([{ NetUid: 'supplier-1' }])

    await expect(getSupplyOrganizations({
      from: '2025-01-17',
      limit: 40,
      offset: 80,
    })).resolves.toEqual([{ NetUid: 'supplier-1', SupplyOrganizationAgreements: [] }])

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/organizations/all/search', {
      query: {
        from: '2025-01-17',
        limit: 40,
        offset: 80,
        to: undefined,
        value: '',
      },
    })
  })

  it('trims supplier organization search values and keeps pagination params', async () => {
    apiRequestMock.mockResolvedValueOnce([{ NetUid: 'supplier-1' }])

    await expect(searchSupplyOrganizations('  service  ', '', {
      limit: 40,
      offset: 0,
    })).resolves.toEqual([{ NetUid: 'supplier-1', SupplyOrganizationAgreements: [] }])

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/organizations/all/search', {
      query: {
        from: undefined,
        limit: 40,
        offset: 0,
        organizationNetId: '',
        to: undefined,
        value: 'service',
      },
    })
  })
})
