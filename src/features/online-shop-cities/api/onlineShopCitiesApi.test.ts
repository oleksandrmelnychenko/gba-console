import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { saveOnlineShopCity } from './onlineShopCitiesApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('online shop cities permission-scoped API', () => {
  beforeEach(() => {
    apiRequestMock.mockReset().mockResolvedValue([])
  })

  it.each(['create', 'edit', 'archive'] as const)(
    'uses the dedicated %s business route',
    async (action) => {
      const city = { Id: action === 'create' ? 0 : 17, NameUa: 'Київ' }

      await saveOnlineShopCity(city, action)

      expect(apiRequestMock).toHaveBeenCalledWith(
        `/seo/info/ecommerce/${action}`,
        { body: city, method: 'POST' },
      )
    },
  )
})
