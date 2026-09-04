import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  getDocumentVerification,
  getDocumentVerificationStorages,
} from './documentVerificationApi'
import { getWarehouseUkraineOrders } from './ordersApi'
import {
  getSaleActProtocolEditDocument,
  getSalePrintDocument,
  getWarehouseUkraineSaleDetails,
  updateWarehouseUkraineSale,
} from './salesApi'
import { getAllShipmentLists, getManualShipmentSales, getShipmentDocument } from './shipmentsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('warehouse Ukraine migrated gap request contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('passes placed state and legacy non-placed filter to the orders endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [], TotalRowsQty: 0 })

    await getWarehouseUkraineOrders({
      from: '2026-06-01T00:00:00',
      to: '2026-06-08T00:00:00',
      limit: 20,
      offset: 0,
      placed: true,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/warehouse-ukraine/all/filtered', {
      query: {
        from: '2026-06-01T00:00:00',
        to: '2026-06-08T00:00:00',
        limit: 20,
        nonPlaced: false,
        offset: 0,
        placed: true,
        supplierName: '',
      },
    })
  })

  it('keeps the old default non-placed orders filter when placed is false', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [], TotalRowsQty: 0 })

    await getWarehouseUkraineOrders({
      from: '2026-06-01T00:00:00',
      to: '2026-06-08T00:00:00',
      limit: 20,
      offset: 0,
      placed: false,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/warehouse-ukraine/all/filtered', {
      query: {
        from: '2026-06-01T00:00:00',
        to: '2026-06-08T00:00:00',
        limit: 20,
        nonPlaced: true,
        offset: 0,
        placed: false,
        supplierName: '',
      },
    })
  })

  it('keeps all selected verification storages in repeated storageId query values', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [], TotalRowsQty: 0 })

    await getDocumentVerification({
      from: 'Mon Jun 01 2026',
      to: 'Mon Jun 08 2026',
      limit: 50,
      offset: 10,
      storageIds: [1, 3, 5],
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/history/order/item/warehouse-ukraine/verification/registry', {
      query: {
        from: 'Mon Jun 01 2026',
        to: 'Mon Jun 08 2026',
        limit: 50,
        offset: 10,
        storageId: [1, 3, 5],
      },
    })
  })

  it('omits transporter net id when all transporters are selected', async () => {
    apiRequestMock.mockResolvedValueOnce([])

    await getAllShipmentLists({
      from: '2026-06-01',
      to: '2026-06-08',
      limit: 20,
      offset: 40,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/shipments/warehouse-ukraine/registry', {
      query: {
        from: '2026-06-01',
        to: '2026-06-08',
        limit: 20,
        offset: 40,
      },
    })
  })

  it('requests manual shipment sale candidates by transporter and explicit date range', async () => {
    apiRequestMock.mockResolvedValueOnce([])

    await getManualShipmentSales({
      transporterNetId: 'transporter-net-id',
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-08T00:00:00.000Z',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/warehouse-ukraine/shipments/sales', {
      query: {
        netId: 'transporter-net-id',
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-08T00:00:00.000Z',
      },
    })
  })

  it('normalizes shipment print documents with PDF-first aliases', async () => {
    apiRequestMock.mockResolvedValueOnce({
      PdfDocument: 'https://example.test/shipment.pdf',
      XlsxDocument: 'https://example.test/shipment.xlsx',
    })

    await expect(getShipmentDocument('shipment-net-id')).resolves.toEqual({
      DocumentURL: 'https://example.test/shipment.xlsx',
      PdfDocumentURL: 'https://example.test/shipment.pdf',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/shipments/warehouse-ukraine/print', {
      query: {
        netId: 'shipment-net-id',
      },
    })
  })

  it('requests the warehouse sale print document through the storage-scoped facade', async () => {
    apiRequestMock.mockResolvedValueOnce({ PdfDocumentURL: 'https://example.test/sale.pdf' })

    await getSalePrintDocument('sale-net-id')

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/warehouse-ukraine/invoices/print', {
      query: {
        netId: 'sale-net-id',
      },
    })
  })

  it('requests the shifted sale print document with act-protocol-edit flag', async () => {
    apiRequestMock.mockResolvedValueOnce({ PdfDocumentURL: 'https://example.test/sale-shifted.pdf' })

    await getSaleActProtocolEditDocument('sale-net-id', true)

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/warehouse-ukraine/invoices/print-edit-act', {
      query: {
        netId: 'sale-net-id',
        IsPrintedActProtocolEdit: true,
      },
    })
  })

  it('loads verification storages through the verification-open scope', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [] })

    await getDocumentVerificationStorages()

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/storages/warehouse-ukraine/verification/all',
    )
  })

  it('loads warehouse invoice details through its exact scoped facade', async () => {
    const sale = { NetUid: 'sale-net-id', Order: { OrderItems: [] } }
    apiRequestMock.mockResolvedValueOnce({
      LifeCycleLine: [],
      Sale: sale,
      SaleExchangeRates: [],
    })

    const result = await getWarehouseUkraineSaleDetails('sale-net-id')

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/warehouse-ukraine/invoices/details', {
      query: { netId: 'sale-net-id' },
    })
    expect(result).toEqual(sale)
  })

  it('keeps accepting a direct sale details payload', async () => {
    const sale = { NetUid: 'sale-net-id', Order: { OrderItems: [] } }
    apiRequestMock.mockResolvedValueOnce(sale)

    await expect(getWarehouseUkraineSaleDetails('sale-net-id')).resolves.toEqual(sale)
  })

  it.each([
    ['invoice', '/sales/warehouse-ukraine/invoices/mark-printed'],
    ['act-protocol', '/sales/warehouse-ukraine/invoices/mark-edit-act-printed'],
  ] as const)('fences the %s print marker with the same operation id', async (printIntent, path) => {
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'sale-net-id' })
    const operationId = 'EEEEEEEE-EEEE-4EEE-8EEE-EEEEEEEEEEEE'

    await updateWarehouseUkraineSale(
      { IsPrinted: true, NetUid: 'sale-net-id', Order: { OrderItems: [{ NetUid: 'row-1' }] } },
      printIntent,
      { operationId },
    )

    expect(apiRequestMock).toHaveBeenCalledWith(path, {
      body: {
        NetUid: 'sale-net-id',
        OperationNetUid: operationId.toLowerCase(),
      },
      headers: { 'Idempotency-Key': operationId.toLowerCase() },
      method: 'POST',
    })
  })
})
