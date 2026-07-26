import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createProductCapitalization,
  exportProductCapitalization,
  getProductCapitalizations,
  parseProductCapitalizationItemsFromFile,
} from './productCapitalizationsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('productCapitalizationsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('gba_console_session', JSON.stringify({
      userNetUid: '11111111-1111-4111-8111-111111111111',
    }))
  })

  it('does not synthesize a total from plain list responses', async () => {
    apiRequestMock.mockResolvedValueOnce([
      { NetUid: 'capitalization-1' },
      { NetUid: 'capitalization-2' },
    ])

    const result = await getProductCapitalizations({
      from: '2026-01-01T00:00:00',
      limit: 2,
      offset: 0,
      to: '2026-01-31T23:59:59',
    })

    expect(result.Items).toHaveLength(2)
    expect(result.Total).toBeNull()
  })

  it('keeps explicit totals from paged responses', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Items: [{ NetUid: 'capitalization-1' }],
      Total: 42,
    })

    const result = await getProductCapitalizations({
      from: '2026-01-01T00:00:00',
      limit: 20,
      offset: 0,
      to: '2026-01-31T23:59:59',
    })

    expect(result.Items).toHaveLength(1)
    expect(result.Total).toBe(42)
  })

  it('exports capitalization documents with PDF-first aliases preserved', async () => {
    apiRequestMock.mockResolvedValueOnce({
      PdfDocument: 'https://example.test/capitalization.pdf',
      XlsxDocument: 'https://example.test/capitalization.xlsx',
    })

    await expect(exportProductCapitalization('capitalization-1')).resolves.toEqual({
      DocumentURL: 'https://example.test/capitalization.xlsx',
      PdfDocumentURL: 'https://example.test/capitalization.pdf',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/products/capitalizations/document/export', {
      query: {
        netId: 'capitalization-1',
      },
    })
  })

  it('sends durable JSON create with matching header/query key and owner', async () => {
    const operationId =
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    apiRequestMock.mockResolvedValueOnce({
      Id: 501,
      NetUid: '99999999-9999-4999-8999-999999999999',
    })

    await createProductCapitalization({
      Comment: 'count correction',
      FromDate: '2026-07-26T10:00:00.000Z',
      Organization: {
        Code: "X'; DROP TABLE ProductCapitalization;--",
        Id: 11,
        NetUid: '22222222-2222-4222-8222-222222222222',
      },
      ProductCapitalizationItems: [{
        Id: 777,
        Product: {
          Id: 31,
          Name: 'untrusted label',
          NetUid: '44444444-4444-4444-8444-444444444444',
        },
        ProductId: 31,
        Qty: 2,
        RemainingQty: 99,
        UnitPrice: 0,
        Weight: 0,
      }],
      Storage: {
        Id: 21,
        Name: 'untrusted storage label',
        NetUid: '33333333-3333-4333-8333-333333333333',
      },
    }, {
      operationId,
    })

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/products/capitalizations/new',
      expect.objectContaining({
        body: {
          Comment: 'count correction',
          FromDate: '2026-07-26T10:00:00.000Z',
          Organization: {
            Id: 11,
            NetUid: '22222222-2222-4222-8222-222222222222',
          },
          OrganizationId: 11,
          ProductCapitalizationItems: [{
            Product: {
              Id: 31,
              NetUid: '44444444-4444-4444-8444-444444444444',
            },
            ProductId: 31,
            Qty: 2,
            UnitPrice: 0,
            Weight: 0,
          }],
          Storage: {
            Id: 21,
            NetUid: '33333333-3333-4333-8333-333333333333',
          },
          StorageId: 21,
        },
        dedupe: false,
        headers: {
          'Idempotency-Key': operationId,
          'X-Product-Capitalization-Owner':
            '11111111-1111-4111-8111-111111111111',
        },
        method: 'POST',
        query: {
          operationNetUid: operationId,
        },
      }),
    )
  })

  it('uses parser-only upload and never calls legacy file-create', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Items: [],
      MissingVendorCodes: [],
    })

    await parseProductCapitalizationItemsFromFile(
      new File(['sheet'], 'items.xlsx'),
      {
        EndRow: 2,
        PriceColumnNumber: 3,
        PricePerItem: true,
        QtyColumnNumber: 2,
        StartRow: 1,
        VendorCodeColumnNumber: 1,
        WeightColumnNumber: 4,
        WeightPerItem: true,
        WithPrice: true,
        WithWeight: true,
      },
    )

    expect(apiRequestMock.mock.calls[0][0])
      .toBe('/products/capitalizations/get/items/file')
    expect(apiRequestMock.mock.calls.flatMap((call) => call[0]))
      .not.toContain('/products/capitalizations/new/file')
  })
})
