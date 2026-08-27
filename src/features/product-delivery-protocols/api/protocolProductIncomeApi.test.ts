import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  addDynamicPlacementRow,
  createProductIncomeFromPackingListDynamic,
  getOrganizationStorages,
  getPackingListSpecificationProducts,
  getProductIncomeByDeliveryProtocolNetId,
  getProductIncomeBySupplyOrderNetId,
  getPzDocumentBySupplyInvoiceId,
  getSupplyOrderInvoiceItems,
  markAllItemsReadyToPlace,
  updateDynamicPlacementRow,
  updatePackingListInInvoice,
  updateVatOfPackListInvoiceItems,
  type ProductIncomeApiScope,
} from './protocolProductIncomeApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('protocol product income API contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('requests the PZ document without unsupported locale or document-type selectors', async () => {
    apiRequestMock.mockResolvedValueOnce({
      DocumentURL: 'https://example.test/pz.xlsx',
      PdfDocumentURL: 'https://example.test/pz.pdf',
    })

    await expect(getPzDocumentBySupplyInvoiceId('delivery-protocol', 'invoice-net-id')).resolves.toEqual({
      DocumentURL: 'https://example.test/pz.xlsx',
      PdfDocumentURL: 'https://example.test/pz.pdf',
    })

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/supplies/invoices/product-income/delivery-protocol/document/pz',
      {
      query: { netId: 'invoice-net-id' },
      },
    )
  })

  it.each<ProductIncomeApiScope>(['delivery-protocol', 'direct-supply-order'])(
    'uses only %s permission-scoped read and edit routes',
    async (scope) => {
      apiRequestMock.mockResolvedValue({})

      await getSupplyOrderInvoiceItems(scope, 'invoice-1')
      await getPackingListSpecificationProducts(scope, 'pack-1')
      await getOrganizationStorages(scope, 'organization-1')
      await updatePackingListInInvoice(scope, { NetUid: 'invoice-1', PackingLists: [] })
      await updateVatOfPackListInvoiceItems(scope, { NetUid: 'invoice-1', PackingLists: [] })
      await addDynamicPlacementRow(scope, { Qty: 1, DynamicProductPlacements: [] })
      await updateDynamicPlacementRow(scope, { Id: 4, Qty: 2, DynamicProductPlacements: [] })
      await markAllItemsReadyToPlace(scope, 'pack-1')

      expect(apiRequestMock.mock.calls.map(([path]) => path)).toEqual([
        `/supplies/invoices/product-income/${scope}/items`,
        `/supplies/packinglists/product-income/${scope}/specification/products`,
        `/storages/product-income/${scope}/storages`,
        `/supplies/packinglists/product-income/${scope}/placement`,
        `/supplies/invoices/product-income/${scope}/vat`,
        `/supplies/ukraine/order/placements/dynamic/rows/product-income/${scope}/new`,
        `/supplies/ukraine/order/placements/dynamic/rows/product-income/${scope}/update`,
        `/supplies/packinglists/product-income/${scope}/readiness`,
      ])
    },
  )

  it.each<ProductIncomeApiScope>(['delivery-protocol', 'direct-supply-order'])(
    'separates %s capitalization and posting mutations',
    async (scope) => {
      apiRequestMock.mockResolvedValue({})
      const packingList = { NetUid: 'pack-1', PackingListPackageOrderItems: [], DynamicProductPlacementColumns: [] }

      await createProductIncomeFromPackingListDynamic(scope, 'capitalize', '2026-08-18', 'storage-1', packingList)
      await createProductIncomeFromPackingListDynamic(scope, 'post', '2026-08-18', 'storage-1', packingList)

      expect(apiRequestMock.mock.calls.map(([path]) => path)).toEqual([
        `/products/incomes/product-income/${scope}/capitalize`,
        `/products/incomes/product-income/${scope}/post`,
      ])
    },
  )

  it('uses independently protected product-income header reads', async () => {
    apiRequestMock.mockResolvedValue({})

    await getProductIncomeByDeliveryProtocolNetId('protocol-1')
    await getProductIncomeBySupplyOrderNetId('order-1')

    expect(apiRequestMock.mock.calls).toEqual([
      ['/products/incomes/product-income/delivery-protocol/header', { query: { netId: 'protocol-1' } }],
      ['/products/incomes/product-income/direct-supply-order/header', { query: { netId: 'order-1' } }],
    ])
  })
})
