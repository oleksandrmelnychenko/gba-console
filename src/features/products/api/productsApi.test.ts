import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  exportProductIncomeMovementsDocument,
  exportProductMovementsDocument,
  exportProductOutcomeMovementsDocument,
  getProductSourcePriceComparison,
  updateProduct,
  updateProductWithImages,
  uploadProductsFromFile,
} from './productsApi'
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
      ImportedForAmg: false,
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

  it('keeps the explicit AMG source for a priced product upload', async () => {
    const configuration = {
      ImportedForAmg: true,
      PriceConfigurations: [{ ColumnNumber: 7, PricingId: 15 }],
      WithPrices: true,
    } as ProductFileUploadConfiguration

    await uploadProductsFromFile(configuration, new File(['vendor'], 'products.xlsx'))

    const body = apiRequestMock.mock.calls[0]?.[1]?.body as FormData

    expect(JSON.parse(String(body.get('configuration')))).toMatchObject({
      ImportedForAmg: true,
      WithPrices: true,
    })
  })

  it('rejects a priced product upload without an explicit source', async () => {
    const configuration = {
      PriceConfigurations: [{ ColumnNumber: 4, PricingId: 12 }],
      WithPrices: true,
    } as ProductFileUploadConfiguration

    await expect(uploadProductsFromFile(configuration, new File(['vendor'], 'products.xlsx')))
      .rejects.toThrow('Оберіть джерело цін: Контех (Fenix) або AMG')
    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('omits the pricing source when the upload has no price columns', async () => {
    const configuration: Partial<ProductFileUploadConfiguration> = {
      ImportedForAmg: true,
      PriceConfigurations: [],
      WithPrices: false,
    }

    await uploadProductsFromFile(configuration as ProductFileUploadConfiguration, new File(['vendor'], 'products.xlsx'))

    const body = apiRequestMock.mock.calls[0]?.[1]?.body as FormData
    const serializedConfiguration = JSON.parse(String(body.get('configuration')))

    expect(serializedConfiguration.WithPrices).toBe(false)
    expect(serializedConfiguration).not.toHaveProperty('ImportedForAmg')
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

  it('normalizes alternate export document field names for product movement documents', async () => {
    apiRequestMock.mockResolvedValueOnce({
      PdfDocument: 'https://example.test/income.pdf',
      XlsxDocument: 'https://example.test/income.xlsx',
    })

    await expect(exportProductIncomeMovementsDocument({
      from: '2026-06-01',
      productNetId: 'product-1',
      to: '2026-06-08',
    })).resolves.toEqual({
      DocumentURL: 'https://example.test/income.xlsx',
      PdfDocumentURL: 'https://example.test/income.pdf',
    })
  })

  it('requests source-aware product prices without changing the product endpoint', async () => {
    const controller = new AbortController()
    const comparison = {
      Amg: { IsAvailable: true, Prices: [{ PriceEur: 1.4, PricingName: 'ЦО2' }] },
      Fenix: { IsAvailable: true, Prices: [{ PriceEur: 1.54, PricingName: 'ЦО2' }] },
      ProductNetId: 'product-1',
    }

    apiRequestMock.mockResolvedValueOnce(comparison)

    await expect(getProductSourcePriceComparison('product-1', controller.signal)).resolves.toEqual(comparison)
    expect(apiRequestMock).toHaveBeenCalledWith('/products/pricings/sources', {
      errorMessages: {
        default: 'Не вдалося завантажити ціни з джерел',
        network: 'Джерела цін недоступні',
      },
      query: { netId: 'product-1' },
      signal: controller.signal,
    })
  })

  it('requests product movement export documents and keeps the PDF alias', async () => {
    apiRequestMock.mockResolvedValueOnce({
      PdfDocument: 'https://example.test/movement.pdf',
      XlsxDocument: 'https://example.test/movement.xlsx',
    })

    await expect(exportProductMovementsDocument({
      from: '2026-06-01',
      movementType: 0,
      productNetId: 'product-1',
      to: '2026-06-08',
      types: [0, 3, 5],
    })).resolves.toEqual({
      DocumentURL: 'https://example.test/movement.xlsx',
      PdfDocumentURL: 'https://example.test/movement.pdf',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/consignments/info/movement/document/export', {
      errorMessages: {
        default: 'Не вдалося сформувати документ руху товару',
        network: 'Сервер експорту руху товару недоступний',
      },
      query: {
        from: '2026-06-01',
        movementType: 0,
        productNetId: 'product-1',
        to: '2026-06-08',
        types: [0, 3, 5],
      },
    })
  })

  it('requests product outcome export documents and keeps the PDF alias', async () => {
    apiRequestMock.mockResolvedValueOnce({
      PdfDocument: 'https://example.test/outcome.pdf',
      XlsxDocument: 'https://example.test/outcome.xlsx',
    })

    await expect(exportProductOutcomeMovementsDocument({
      from: '2026-07-07',
      productNetId: 'product-1',
      to: '2026-07-07',
    })).resolves.toEqual({
      DocumentURL: 'https://example.test/outcome.xlsx',
      PdfDocumentURL: 'https://example.test/outcome.pdf',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/consignments/info/outcome/document/export', {
      errorMessages: {
        default: 'Не вдалося сформувати документ виходу',
        network: 'Сервер експорту виходу недоступний',
      },
      query: {
        from: '2026-07-07',
        productNetId: 'product-1',
        to: '2026-07-07',
      },
    })
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
