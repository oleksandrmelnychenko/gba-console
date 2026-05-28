import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import type { Client } from '../types'
import { getNewEcommerceClients } from './ecommerceClientsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('e-commerce clients API query contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads newly registered e-commerce clients from the source endpoint', async () => {
    const clients: Client[] = [
      {
        Created: '2026-05-27T09:30:00Z',
        FullName: 'GBA Test Client',
        NetUid: 'client-net-id',
      },
    ]

    apiRequestMock.mockResolvedValueOnce(clients)

    await expect(getNewEcommerceClients()).resolves.toEqual(clients)
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/all/ecommerce')
  })

  it('normalizes paged-like responses defensively', async () => {
    const client: Client = { FullName: 'Paged Client', NetUid: 'paged-client' }

    apiRequestMock.mockResolvedValueOnce({ Items: [client] })

    await expect(getNewEcommerceClients()).resolves.toEqual([client])
  })
})
