import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  getProductIncomeMovements,
  getProductMovements,
  getProductOutcomeMovements,
  getProductSiblingCounts,
  getProductSiblings,
} from './productsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)
const currentNetId = '37d7acb3-ad54-4d86-8f94-d5c2aff6ad6a'
const siblingNetId = 'f43233de-1889-4a52-923e-fca071adcfa3'

function lastQuery(): Record<string, unknown> {
  return apiRequestMock.mock.calls.at(-1)?.[1]?.query as Record<string, unknown>
}

describe('product movement reads with sibling cards', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue([])
  })

  it.each([
    ['income', getProductIncomeMovements, '/consignments/info/assortment/income/filtered'],
    ['outcome', getProductOutcomeMovements, '/consignments/info/assortment/outcome/filtered'],
  ] as const)('keeps the %s request unchanged unless sibling cards are requested', async (_direction, load, path) => {
    await load({ from: '2026-08-01', productNetId: currentNetId, to: '2026-08-31' })

    expect(apiRequestMock).toHaveBeenLastCalledWith(path, expect.objectContaining({
      query: { from: '2026-08-01', productNetId: currentNetId, to: '2026-08-31' },
    }))
    expect(lastQuery()).not.toHaveProperty('includeSiblings')

    await load({ from: '2026-08-01', includeSiblings: false, productNetId: currentNetId, to: '2026-08-31' })

    expect(lastQuery()).not.toHaveProperty('includeSiblings')

    await load({ from: '2026-08-01', includeSiblings: true, productNetId: currentNetId, to: '2026-08-31' })

    expect(apiRequestMock).toHaveBeenLastCalledWith(path, expect.objectContaining({
      query: { from: '2026-08-01', includeSiblings: true, productNetId: currentNetId, to: '2026-08-31' },
    }))
  })

  it('asks the product movement endpoint for sibling rows only when requested', async () => {
    const params = { from: '2026-08-01', movementType: 0, productNetId: currentNetId, to: '2026-08-31', types: [0, 3] }

    await getProductMovements(params)

    expect(apiRequestMock).toHaveBeenLastCalledWith('/consignments/info/assortment/movement/filtered', expect.objectContaining({
      query: params,
    }))
    expect(lastQuery()).not.toHaveProperty('includeSiblings')

    await getProductMovements({ ...params, includeSiblings: true })

    expect(lastQuery()).toEqual({ ...params, includeSiblings: true })
  })

  it('returns the card reference carried by merged sibling rows', async () => {
    const card = {
      IsCurrent: false,
      Name: 'Ступица колеса',
      ProductId: 38286393,
      ProductNetId: siblingNetId,
      SourceAmgCode: 464929,
      SourceFenixCode: null,
      VendorCode: '0701000260-MG',
    }
    apiRequestMock.mockResolvedValue([{ Card: card, DocumentNumber: 'AMG-1', Qty: 4 }])

    const rows = await getProductOutcomeMovements({
      from: '2026-08-01',
      includeSiblings: true,
      productNetId: currentNetId,
      to: '2026-08-31',
    })

    expect(rows).toEqual([{ Card: card, DocumentNumber: 'AMG-1', Qty: 4 }])
  })
})

describe('product sibling cards API', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads and normalizes the sibling cards of a product', async () => {
    const signal = new AbortController().signal
    apiRequestMock.mockResolvedValue({
      Cards: [
        {
          Availabilities: [{ Amount: 6, OrganizationName: 'ТОВ «АМГ «КОНКОРД»', StorageId: 2968, StorageName: 'СКЛАД -3' }],
          IsCurrent: true,
          LastActivityAt: '2026-08-06T10:04:41',
          Name: 'Ступица колеса',
          ProductId: 38060322,
          ProductNetId: currentNetId,
          SalesCount: 0,
          SoldQty: 0,
          SourceAmgCode: 382707,
          SourceFenixCode: 382707,
          StockQty: 6,
          VendorCode: '0701000260-MG',
        },
        {
          IsCurrent: false,
          LastActivityAt: null,
          Name: 'Ступица колеса',
          ProductId: 38286393,
          ProductNetId: siblingNetId,
          SalesCount: 3,
          SoldQty: 4,
          SourceAmgCode: 464929,
          SourceFenixCode: null,
          StockQty: 0,
          VendorCode: '0701000260-MG',
        },
        { ProductId: 1 },
        null,
      ],
      ProductNetId: currentNetId,
    })

    const group = await getProductSiblings(currentNetId, signal)

    expect(apiRequestMock).toHaveBeenCalledWith('/products/assortment/siblings', expect.objectContaining({
      query: { productNetId: currentNetId },
      signal,
    }))
    expect(group.ProductNetId).toBe(currentNetId)
    expect(group.Cards.map((card) => card.ProductId)).toEqual([38060322, 38286393])
    expect(group.Cards[0].Availabilities).toEqual([
      { Amount: 6, OrganizationName: 'ТОВ «АМГ «КОНКОРД»', StorageId: 2968, StorageName: 'СКЛАД -3' },
    ])
    expect(group.Cards[1].Availabilities).toEqual([])
    expect(group.Cards[1]).toMatchObject({ IsCurrent: false, SoldQty: 4, SourceAmgCode: 464929, SourceFenixCode: null })
  })

  it.each([
    [{ Cards: [], ProductNetId: currentNetId }],
    [null],
    ['unexpected'],
    [[]],
  ])('treats %j as a product without sibling cards', async (payload) => {
    apiRequestMock.mockResolvedValue(payload)

    await expect(getProductSiblings(currentNetId)).resolves.toEqual({ Cards: [], ProductNetId: currentNetId })
  })

  it('requests sibling counts once for the visible products and keeps only products with siblings', async () => {
    apiRequestMock.mockResolvedValue([
      { ProductNetId: currentNetId, SiblingCount: 1 },
      { ProductNetId: 'no-siblings', SiblingCount: 0 },
      { ProductNetId: '', SiblingCount: 2 },
      { SiblingCount: 2 },
    ])

    const counts = await getProductSiblingCounts([currentNetId, ` ${currentNetId} `, '', 'other-product'])

    expect(apiRequestMock).toHaveBeenCalledTimes(1)
    expect(apiRequestMock).toHaveBeenCalledWith('/products/assortment/siblings/counts', expect.objectContaining({
      query: { productNetIds: [currentNetId, 'other-product'] },
    }))
    expect(counts).toEqual([{ ProductNetId: currentNetId, SiblingCount: 1 }])
  })

  it('splits sibling count requests at 100 products to stay under the request-line limit', async () => {
    const productNetIds = Array.from({ length: 101 }, (_, index) => `product-${index}`)
    apiRequestMock
      .mockResolvedValueOnce([{ ProductNetId: 'product-0', SiblingCount: 1 }])
      .mockResolvedValueOnce([{ ProductNetId: 'product-100', SiblingCount: 2 }])

    const counts = await getProductSiblingCounts(productNetIds)

    expect(apiRequestMock).toHaveBeenCalledTimes(2)
    expect((apiRequestMock.mock.calls[0][1]?.query as { productNetIds: string[] }).productNetIds).toHaveLength(100)
    expect((apiRequestMock.mock.calls[1][1]?.query as { productNetIds: string[] }).productNetIds).toEqual(['product-100'])
    expect(counts).toEqual([
      { ProductNetId: 'product-0', SiblingCount: 1 },
      { ProductNetId: 'product-100', SiblingCount: 2 },
    ])
  })

  it('does not call the server without product identifiers', async () => {
    await expect(getProductSiblingCounts(['', '  '])).resolves.toEqual([])
    expect(apiRequestMock).not.toHaveBeenCalled()
  })
})
