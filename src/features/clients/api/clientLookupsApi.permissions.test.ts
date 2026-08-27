import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createCountry, createIncoterm, createRegion } from './clientLookupsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('client inline reference-data permission routes', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it.each([
    ['country', () => createCountry({ Code: 'UA', Name: 'Україна' }), '/countries/clients/new'],
    ['incoterm', () => createIncoterm({ IncotermName: 'DAP' }), '/incoterms/clients/new'],
    ['region', () => createRegion({ Name: 'Київська' }), '/regions/clients/new'],
  ] as const)('uses the scoped %s create facade', async (_name, create, route) => {
    apiRequestMock.mockResolvedValueOnce({ Name: 'created' })

    await create()

    expect(apiRequestMock).toHaveBeenCalledWith(
      route,
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
