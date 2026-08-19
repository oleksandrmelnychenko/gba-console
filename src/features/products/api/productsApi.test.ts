import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  exportProductIncomeMovementsDocument,
  exportProductMovementsDocument,
  exportProductOutcomeMovementsDocument,
  getProductAuditEntities,
  getProductForOrderInvoices,
  getProductForOrderSpecifications,
  getProductIncomeMovements,
  getProductOutcomeMovements,
  getProductSourcePriceComparison,
  getProductStorageLocationHistory,
  resetProductPlacementMutationStateForTests,
  updateProduct,
  updateProductPlacements,
  updateProductWithImages,
  uploadProductsFromFile,
} from './productsApi'
import type { Product, ProductFileUploadConfiguration, ProductPlacement } from '../types'

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

    expect(apiRequestMock).toHaveBeenCalledWith('/products/assortment/upload/file', expect.objectContaining({ method: 'POST' }))
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

    expect(apiRequestMock).toHaveBeenCalledWith('/products/assortment/update', expect.objectContaining({ method: 'POST' }))
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

    await updateProductWithImages(product, [file], 'upload-and-delete')

    const body = apiRequestMock.mock.calls[0]?.[1]?.body as FormData
    const payload = JSON.parse(String(body.get('entity'))) as Product

    expect(apiRequestMock).toHaveBeenCalledWith('/products/assortment/images/upload-and-delete', expect.objectContaining({ method: 'POST' }))
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

    expect(apiRequestMock).toHaveBeenCalledWith('/consignments/info/assortment/movement/document/export', {
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

    expect(apiRequestMock).toHaveBeenCalledWith('/consignments/info/assortment/outcome/document/export', {
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

  it('loads an order-specification product card through its scoped read facade', async () => {
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'product-1' })
    const controller = new AbortController()

    await getProductForOrderSpecifications('product-1', controller.signal)

    expect(apiRequestMock).toHaveBeenCalledWith('/products/orders-ukraine/specifications/details', {
      query: { netId: 'product-1' },
      signal: controller.signal,
    })
  })

  it('loads a direct-order invoice product card through its scoped read facade', async () => {
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'product-1' })
    const controller = new AbortController()

    await getProductForOrderInvoices('product-1', controller.signal)

    expect(apiRequestMock).toHaveBeenCalledWith('/products/orders-ukraine/invoices/details', {
      query: { netId: 'product-1' },
      signal: controller.signal,
    })
  })

  it('uses permission-scoped aliases for product audit, placement history, and inline movement reads', async () => {
    apiRequestMock.mockResolvedValue([])

    await getProductAuditEntities('product-1', 'Description')
    await getProductStorageLocationHistory({
      from: '2026-08-01',
      limit: 20,
      offset: 0,
      productNetId: 'product-1',
      to: '2026-08-18',
    })
    await getProductIncomeMovements({
      from: '2026-08-01',
      productNetId: 'product-1',
      to: '2026-08-18',
    })
    await getProductOutcomeMovements({
      from: '2026-08-01',
      productNetId: 'product-1',
      to: '2026-08-18',
    })

    expect(apiRequestMock.mock.calls.map(([path]) => path)).toEqual([
      '/auditing/products/assortment/history',
      '/products/placements/history/assortment/all/filtered',
      '/consignments/info/assortment/income/filtered',
      '/consignments/info/assortment/outcome/filtered',
    ])
  })
})

describe('product placement durable mutation', () => {
  const ownerA = '11111111-1111-4111-8111-111111111111'
  const ownerB = '22222222-2222-4222-8222-222222222222'

  beforeEach(() => {
    apiRequestMock.mockReset()
    localStorage.clear()
    resetProductPlacementMutationStateForTests()
    setSession(ownerA)
  })

  it('aggregates multiple lineage rows in one cell and accepts the expanded server response', async () => {
    const response = [
      placement({ Id: 11, Qty: 2, ConsignmentItemId: 101 }),
      placement({ Id: 12, Qty: 3, ConsignmentItemId: 102 }),
    ]
    apiRequestMock.mockResolvedValueOnce(response)

    await expect(updateProductPlacements(response)).resolves.toEqual(response)

    expect(apiRequestMock.mock.calls[0]?.[0]).toBe('/products/placements/storage/assortment/update')

    const [, options] = apiRequestMock.mock.calls[0]
    const body = options?.body as ProductPlacement[]
    const operationNetUid = new Headers(options?.headers).get('Idempotency-Key')

    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({
      Id: 11,
      Qty: 5,
      ConsignmentItemId: 101,
      StorageNumber: 'A',
      RowNumber: '1',
      CellNumber: '2',
    })
    expect(operationNetUid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(new Headers(options?.headers).get('X-Product-Placement-Update-Owner')).toBe(ownerA)
    expect(options?.query).toEqual({ operationNetUid })
    expect(readPendingOperationKeys()).toEqual([])
  })

  it.each([408, 500, 504])(
    'retains and reuses the operation after an unknown %s outcome',
    async (status) => {
    apiRequestMock
      .mockRejectedValueOnce(Object.assign(new Error('unknown'), { status }))
      .mockResolvedValueOnce([])
    const rows = [placement({ Id: 11, Qty: 5 })]

    await expect(updateProductPlacements(rows)).rejects.toThrow('unknown')
    await updateProductPlacements(rows)

    expect(apiRequestMock).toHaveBeenCalledTimes(2)
    expect(readOperationKey(0)).toBe(readOperationKey(1))
    },
  )

  it.each(['not-entered', 'rolled-back'])(
    'clears an operation only after the server proves %s',
    async (ledgerState) => {
    apiRequestMock
      .mockRejectedValueOnce(createMutationError(409, ledgerState))
      .mockResolvedValueOnce([])
    const rows = [placement({ Id: 11, Qty: 5 })]

    await expect(updateProductPlacements(rows)).rejects.toThrow('conflict')
    await updateProductPlacements(rows)

    expect(readOperationKey(0)).not.toBe(readOperationKey(1))
    },
  )

  it('retains the key for a 4xx response without rollback proof', async () => {
    apiRequestMock
      .mockRejectedValueOnce(createMutationError(400))
      .mockResolvedValueOnce([])
    const rows = [placement({ Id: 11, Qty: 5 })]

    await expect(updateProductPlacements(rows)).rejects.toThrow('conflict')
    await updateProductPlacements(rows)

    expect(readOperationKey(0)).toBe(readOperationKey(1))
  })

  it('fails closed without deleting a corrupted pending operation', async () => {
    apiRequestMock.mockRejectedValueOnce(
      Object.assign(new Error('unknown'), { status: 504 }),
    )
    const rows = [placement({ Id: 11, Qty: 5 })]

    await expect(updateProductPlacements(rows)).rejects.toThrow('unknown')
    const [storageKey] = readPendingOperationKeys()
    localStorage.setItem(storageKey, '{')

    await expect(updateProductPlacements(rows))
      .rejects.toThrow('Збережена операція розміщення пошкоджена')
    expect(apiRequestMock).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(storageKey)).toBe('{')
  })

  it('does not reuse another authenticated owner operation', async () => {
    apiRequestMock
      .mockRejectedValueOnce(Object.assign(new Error('network'), { status: 0 }))
      .mockResolvedValueOnce([])
    const rows = [placement({ Id: 11, Qty: 5 })]

    await expect(updateProductPlacements(rows)).rejects.toThrow('network')
    setSession(ownerB)
    await updateProductPlacements(rows)

    expect(readOperationKey(0)).not.toBe(readOperationKey(1))
    expect(
      new Headers(apiRequestMock.mock.calls[0]?.[1]?.headers)
        .get('X-Product-Placement-Update-Owner'),
    ).toBe(ownerA)
    expect(
      new Headers(apiRequestMock.mock.calls[1]?.[1]?.headers)
        .get('X-Product-Placement-Update-Owner'),
    ).toBe(ownerB)
    expect(readPendingOperationKeys()).toHaveLength(1)
    expect(readPendingOperationKeys()[0]).toContain(ownerA)
  })

  it('deduplicates concurrent saves and sends an immutable snapshot', async () => {
    let resolveRequest: ((value: unknown) => void) | undefined
    apiRequestMock.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )
    const rows = [placement({ Id: 11, Qty: 5 })]

    const first = updateProductPlacements(rows)
    const second = updateProductPlacements(rows)
    rows[0].Qty = 99

    expect(first).toBe(second)
    await vi.waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1))
    expect((apiRequestMock.mock.calls[0]?.[1]?.body as ProductPlacement[])[0].Qty).toBe(5)
    resolveRequest?.([])
    await expect(first).resolves.toEqual([])
  })

  function readOperationKey(callIndex: number): string | null {
    return new Headers(apiRequestMock.mock.calls[callIndex]?.[1]?.headers).get('Idempotency-Key')
  }

  function readPendingOperationKeys(): string[] {
    return Array.from(
      { length: localStorage.length },
      (_, index) => localStorage.key(index),
    ).filter(
      (key): key is string =>
        Boolean(key?.startsWith('gba.products.placement-update.v1:')),
    )
  }

  function createMutationError(status: number, ledgerState?: string): Error & {
    headers: Headers
    status: number
  } {
    return Object.assign(new Error('conflict'), {
      headers: new Headers(
        ledgerState
          ? { 'X-Product-Placement-Update-Ledger-State': ledgerState }
          : undefined,
      ),
      status,
    })
  }

  function setSession(ownerNetUid: string) {
    localStorage.setItem('gba_console_session', JSON.stringify({
      csrfToken: 'csrf',
      userNetUid: ownerNetUid,
    }))
  }

  function placement(overrides: Partial<ProductPlacement>): ProductPlacement {
    return {
      CellNumber: '2',
      ProductId: 41,
      Qty: 5,
      RowNumber: '1',
      StorageId: 51,
      StorageNumber: 'A',
      ...overrides,
    }
  }
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
