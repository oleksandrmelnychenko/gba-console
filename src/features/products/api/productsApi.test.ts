import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { uploadProductsFromFile } from './productsApi'
import type { ProductFileUploadConfiguration } from '../types'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('products API upload contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('uploads one product file with serialized configuration', async () => {
    const configuration = {
      PriceConfigurations: [{ ColumnNumber: 4, PricingId: 12 }],
      WithPrices: true,
    } as ProductFileUploadConfiguration
    const file = new File(['vendor'], 'products.xlsx')

    await uploadProductsFromFile(configuration, file)

    const [, options] = apiRequestMock.mock.calls[0]
    const body = options?.body as FormData

    expect(apiRequestMock).toHaveBeenCalledWith('/products/upload/file', expect.objectContaining({ method: 'POST' }))
    expect(body).toBeInstanceOf(FormData)
    expect(body.getAll('file')).toEqual([file])
    expect(JSON.parse(String(body.get('configuration')))).toEqual(configuration)
  })
})
