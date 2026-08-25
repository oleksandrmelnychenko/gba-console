import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { searchMeasureUnits } from './consumableProductsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

describe('consumable-products measure units API', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset()
  })

  it('loads the complete company-resource list for an empty search', async () => {
    vi.mocked(apiRequest).mockResolvedValue([{ Id: 1, Name: 'шт' }])

    await expect(searchMeasureUnits('')).resolves.toEqual([{ Id: 1, Name: 'шт' }])
    expect(apiRequest).toHaveBeenCalledWith('/measureunits/all')
  })

  it('keeps server-side search for a typed value', async () => {
    vi.mocked(apiRequest).mockResolvedValue([{ Id: 2, Name: 'послуга' }])

    await searchMeasureUnits('  пос  ')

    expect(apiRequest).toHaveBeenCalledWith('/measureunits/search', {
      query: { value: 'пос' },
    })
  })
})
