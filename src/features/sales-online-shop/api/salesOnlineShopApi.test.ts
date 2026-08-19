import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, apiUrl, getApiLanguage } from '../../../shared/api/apiClient'
import {
  getEcommerceImageSearch,
  getEcommerceImageSearches,
  getEcommerceImageSearchImageUrl,
  getSalesOnlineShop,
} from './salesOnlineShopApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
  apiUrl: vi.fn(),
  getApiLanguage: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('Sales Online Shop permission-scoped reads', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    vi.mocked(apiUrl).mockReset()
    vi.mocked(getApiLanguage).mockReset()
  })

  it('loads the registry through the page-scoped facade', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [] })

    await getSalesOnlineShop({
      from: '2026-08-19',
      limit: 20,
      offset: 0,
      status: 'all',
      to: '2026-08-19',
      type: 'All',
      value: '  client  ',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/online-shop/registry', expect.objectContaining({
      query: expect.objectContaining({
        fastEcommerce: true,
        forEcommerce: true,
        includeDetails: false,
        value: 'client',
      }),
    }))
  })

  it('keeps image-search list, detail and image reads on their protected resource', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [], Limit: 20, Offset: 0, Total: 0 })
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'search-1' })
    vi.mocked(getApiLanguage).mockReturnValue('uk')
    vi.mocked(apiUrl).mockReturnValue('/resolved-image')

    await getEcommerceImageSearches({ limit: 20, offset: 0, status: 'all', value: '' })
    await getEcommerceImageSearch('search-1')
    expect(getEcommerceImageSearchImageUrl('search-1')).toBe('/resolved-image')

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/ecommerce/image-searches', {
      query: { limit: 20, offset: 0, status: undefined, value: undefined },
      signal: undefined,
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/ecommerce/image-searches/search-1', {
      signal: undefined,
    })
    expect(apiUrl).toHaveBeenCalledWith('/ecommerce/image-searches/search-1/image', 'uk')
  })
})
