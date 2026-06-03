import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { updateProduct, updateProductWithImages, uploadProductsFromFile } from './productsApi'
import type { Product, ProductFileUploadConfiguration } from '../types'

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

  it('updates scalar product fields without sending heavy relation collections', async () => {
    const product = createProductWithRelations()

    apiRequestMock.mockResolvedValueOnce({ NetUid: 'product-1' })

    await updateProduct(product)

    const body = apiRequestMock.mock.calls[0]?.[1]?.body as Product

    expect(apiRequestMock).toHaveBeenCalledWith('/products/update', expect.objectContaining({ method: 'POST' }))
    expect(body).toMatchObject({
      Description: 'Description',
      IsForSale: true,
      NetUid: 'product-1',
      VendorCode: 'ABC-1',
    })
    expect(body).not.toHaveProperty('AnalogueProducts')
    expect(body).not.toHaveProperty('BaseAnalogueProducts')
    expect(body).not.toHaveProperty('BaseSetProducts')
    expect(body).not.toHaveProperty('CalculatedPrices')
    expect(body).not.toHaveProperty('ComponentProducts')
    expect(body).not.toHaveProperty('ProductAvailabilities')
    expect(body).not.toHaveProperty('ProductImages')
    expect(body).not.toHaveProperty('ProductOriginalNumbers')
    expect(body).not.toHaveProperty('ProductPricings')
    expect(body).not.toHaveProperty('ProductProductGroups')
    expect(body).not.toHaveProperty('ProductSpecifications')
  })

  it('keeps image changes in multipart product image updates without unrelated collections', async () => {
    const product = createProductWithRelations()
    const file = new File(['image'], 'new.jpg', { type: 'image/jpeg' })

    apiRequestMock.mockResolvedValueOnce({ NetUid: 'product-1' })

    await updateProductWithImages(product, [file])

    const body = apiRequestMock.mock.calls[0]?.[1]?.body as FormData
    const payload = JSON.parse(String(body.get('entity'))) as Product

    expect(apiRequestMock).toHaveBeenCalledWith('/products/update/upload', expect.objectContaining({ method: 'POST' }))
    expect(body.getAll('images')).toEqual([file])
    expect(payload.ProductImages).toEqual([
      { Id: 1, ImageUrl: 'https://example.test/old.jpg' },
      { Deleted: true, NetUid: 'image-2' },
      { FileName: 'new.jpg' },
    ])
    expect(payload).not.toHaveProperty('ProductOriginalNumbers')
    expect(payload).not.toHaveProperty('ProductSpecifications')
    expect(payload).not.toHaveProperty('ProductProductGroups')
  })
})

function createProductWithRelations(): Product {
  return {
    AnalogueProducts: [{ NetUid: 'analogue-link' }],
    AvailableQtyUk: 3,
    BaseAnalogueProducts: [{ NetUid: 'base-analogue-link' }],
    BaseSetProducts: [{ NetUid: 'set-link' }],
    CalculatedPrices: [{ PriceEUR: 12 }],
    ComponentProducts: [{ NetUid: 'component-link' }],
    Description: 'Description',
    IsForSale: true,
    NetUid: 'product-1',
    ProductAvailabilities: [{ Amount: 2 }],
    ProductImages: [
      { Id: 1, ImageUrl: 'https://example.test/old.jpg' },
      { Deleted: true, NetUid: 'image-2' },
      {},
      { FileName: 'new.jpg' },
    ],
    ProductOriginalNumbers: [{ OriginalNumber: { Number: 'OEM-1' } }],
    ProductPricings: [{ NetUid: 'pricing-link' }],
    ProductProductGroups: [{ ProductGroup: { Name: 'Group', NetUid: 'group-1' } }],
    ProductSpecifications: [{ Name: 'Spec', NetUid: 'spec-1' }],
    VendorCode: 'ABC-1',
  }
}
