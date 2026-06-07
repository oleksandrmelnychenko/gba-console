import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  getOrganizationPaymentTasks,
  searchServiceOrganizations,
} from './organisationServicesApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('organisationServicesApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('searches service organizations with any non-empty trimmed value', async () => {
    apiRequestMock.mockResolvedValueOnce([{ Name: 'A', ServiceOrganizationTypes: [0] }])

    await expect(searchServiceOrganizations(' A ')).resolves.toEqual([
      { Name: 'A', ServiceOrganizationTypes: [0] },
    ])
    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/services/search/organizations/all', {
      query: {
        value: 'A',
      },
    })
  })

  it('formats payment task date filters through the shared date query formatter', async () => {
    apiRequestMock.mockResolvedValueOnce({
      SupplyPaymentTasks: [],
      Total: '10',
      TotalByRange: '5',
    })

    await expect(getOrganizationPaymentTasks({
      organizationName: 'Customs LTD',
      serviceTypes: [0, 1],
      from: ' 2026-06-01 ',
      to: '2026-06-03T09:30',
    })).resolves.toEqual({
      SupplyPaymentTasks: [],
      Total: 10,
      TotalByRange: 5,
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/services/search/organizations/paymenttasks/all', {
      query: {
        organizationName: 'Customs LTD',
        serviceTypes: [0, 1],
        from: '2026-06-01',
        to: '2026-06-03T09:30:00',
      },
    })
  })

  it('reads payment tasks from collection-shaped responses', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Collection: [
        {
          NetUid: 'task-1',
          GrossPrice: 120,
          MergedServices: [{ Id: 1 }],
        },
      ],
      Total: 1,
      TotalByRange: 1,
    })

    await expect(getOrganizationPaymentTasks({
      organizationName: 'Carrier LTD',
      serviceTypes: [4],
      from: '2026-06-01',
      to: '2026-06-30',
    })).resolves.toMatchObject({
      SupplyPaymentTasks: [
        {
          NetUid: 'task-1',
          GrossPrice: 120,
          MergedServices: [{ Id: 1 }],
          SupplyPaymentTaskDocuments: [],
        },
      ],
      Total: 1,
      TotalByRange: 1,
    })
  })
})
