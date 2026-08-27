import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  carryOutShipmentList,
  getAutoShipmentList,
  getShipmentCreatePageDocument,
  updateDeliveryRecipient,
  updateDeliveryRecipientAddress,
  updateSaleComment,
  updateShipmentList,
} from './shipmentsApi'
import type { ShipmentList } from '../shipmentTypes'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('shipment sale mutation contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue(null)
  })

  it('uses one operation id in comment body and header', async () => {
    const operationId = '11111111-1111-4111-8111-111111111111'

    await updateSaleComment('sale-1', 'comment', { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/warehouse-ukraine/shipments/edit-comment', {
      body: { Comment: 'comment', NetUid: 'sale-1', OperationNetUid: operationId },
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
      query: { netId: 'sale-1' },
    })
  })

  it('uses one operation id in recipient body and header', async () => {
    const operationId = '22222222-2222-4222-8222-222222222222'

    await updateDeliveryRecipient('sale-1', { FullName: 'Recipient', SaleNetId: 'sale-1' }, { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/warehouse-ukraine/shipments/edit-recipient', {
      body: { FullName: 'Recipient', OperationNetUid: operationId, SaleNetId: 'sale-1' },
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
      query: { netId: 'sale-1' },
    })
  })

  it('uses one operation id in recipient-address body and header', async () => {
    const operationId = '33333333-3333-4333-8333-333333333333'

    await updateDeliveryRecipientAddress('sale-1', { City: 'Kyiv', SaleNetId: 'sale-1' }, { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/warehouse-ukraine/shipments/edit-address', {
      body: { City: 'Kyiv', OperationNetUid: operationId, SaleNetId: 'sale-1' },
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
      query: { netId: 'sale-1' },
    })
  })

  it('uses one operation id for the mutating automatic shipment request', async () => {
    const operationId = '44444444-4444-4444-8444-444444444444'
    const transporterNetId = '55555555-5555-4555-8555-555555555555'

    await getAutoShipmentList(
      { transporterNetId, from: '2026-07-01', to: '2026-07-08' },
      { operationId },
    )

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/shipments/warehouse-ukraine/create/auto', {
      headers: { 'Idempotency-Key': operationId },
      query: { netId: transporterNetId, from: '2026-07-01', to: '2026-07-08' },
    })
  })

  it('validates and sends a shipment update with its visible date window', async () => {
    const operationId = '66666666-6666-4666-8666-666666666666'
    const shipmentList = buildShipmentList()
    const persistedShipmentList = {
      ...shipmentList,
      Updated: '2026-07-08T12:00:00.1234567Z',
      ShipmentListItems: shipmentList.ShipmentListItems.map((item) => ({ ...item, QtyPlaces: 5 })),
    }
    apiRequestMock.mockResolvedValueOnce(persistedShipmentList)

    const result = await updateShipmentList(
      shipmentList,
      { operationId },
      { from: '2026-07-01T00:00:00', to: '2026-07-08T23:59:59' },
    )

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/shipments/warehouse-ukraine/edit', {
      body: shipmentList,
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
      query: { from: '2026-07-01T00:00:00', to: '2026-07-08T23:59:59' },
    })
    expect(result).toEqual(persistedShipmentList)
  })

  it('uses an independent carry-out endpoint with the unchanged update contract', async () => {
    const operationId = '99999999-9999-4999-8999-999999999999'
    const shipmentList = { ...buildShipmentList(), IsSent: true }

    await carryOutShipmentList(
      shipmentList,
      { operationId },
      { from: '2026-07-01T00:00:00', to: '2026-07-08T23:59:59' },
    )

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/shipments/warehouse-ukraine/carry-out', {
      body: shipmentList,
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
      query: { from: '2026-07-01T00:00:00', to: '2026-07-08T23:59:59' },
    })
  })

  it('uses one operation id when create-page document generation mutates the shipment list', async () => {
    const operationId = '77777777-7777-4777-8777-777777777777'
    const transporterNetId = '88888888-8888-4888-8888-888888888888'

    await getShipmentCreatePageDocument(
      { transporterNetId, from: '2026-07-01', to: '2026-07-08' },
      { operationId },
    )

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/shipments/warehouse-ukraine/print/create', {
      headers: { 'Idempotency-Key': operationId },
      query: { netId: transporterNetId, from: '2026-07-01', to: '2026-07-08' },
    })
  })

  it('requires operations before active shipment mutations reach the API client', async () => {
    const params = {
      transporterNetId: '88888888-8888-4888-8888-888888888888',
      from: '2026-07-01',
      to: '2026-07-08',
    }
    const autoWithoutOperation = () => {
      // @ts-expect-error Automatic shipment mutation requires an operation.
      return getAutoShipmentList(params)
    }
    const updateWithoutOperation = () => {
      // @ts-expect-error Shipment update requires an operation.
      return updateShipmentList(buildShipmentList())
    }
    const documentWithoutOperation = () => {
      // @ts-expect-error Shipment document mutation requires an operation.
      return getShipmentCreatePageDocument(params)
    }

    await expect(autoWithoutOperation()).rejects.toThrow()
    await expect(updateWithoutOperation()).rejects.toThrow()
    await expect(documentWithoutOperation()).rejects.toThrow()
    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('rejects a duplicate sale in a shipment before sending it', async () => {
    const shipmentList = buildShipmentList()
    shipmentList.ShipmentListItems.push({
      Id: 31,
      NetUid: '99999999-9999-4999-8999-999999999999',
      QtyPlaces: 1,
      Sale: { Id: 20, NetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    })

    await expect(updateShipmentList(
      shipmentList,
      { operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    )).rejects.toThrow('Один продаж не можна додати до відомості двічі')
    expect(apiRequestMock).not.toHaveBeenCalled()
  })
})

function buildShipmentList(): ShipmentList {
  return {
    Id: 10,
    NetUid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    ShipmentListItems: [
      {
        Id: 30,
        NetUid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        QtyPlaces: 2,
        Sale: { Id: 20, NetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      },
    ],
  }
}
