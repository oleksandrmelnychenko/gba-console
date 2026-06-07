import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { uploadDirectSupplyOrderFromFile, uploadSupplyOrderUkraineFromSupplierFile } from './supplyUkraineOrdersApi'
import type {
  Client,
  ClientAgreement,
  DirectSupplyOrderCreatePayload,
  Organization,
  SupplyOrderDocumentParseConfiguration,
  SupplyOrderUkraineSupplierCreatePayload,
  UkraineOrderFromSupplierParseConfiguration,
} from '../types'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('supplyUkraineOrdersApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('uploads supplier-created Ukraine orders to the Ukraine supplier file endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce({
      SupplyOrderUkraine: { NetUid: 'ukraine-order-1' },
    })

    const response = await uploadSupplyOrderUkraineFromSupplierFile({
      file: new File(['xlsx'], 'order.xlsx'),
      orderUkraine: createOrderUkraine(),
      parseConfiguration: createParseConfiguration(),
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/ukraine/order/new/supplier/file', {
      body: expect.any(FormData),
      method: 'POST',
    })

    const formData = apiRequestMock.mock.calls[0]?.[1]?.body as FormData

    expect(formData.get('file')).toBeInstanceOf(File)
    expect(JSON.parse(String(formData.get('parseConfiguration')))).toMatchObject({
      IsPricePerItem: true,
      UnitPriceColumnNumber: 5,
      VendorCodeColumnNumber: 1,
    })
    expect(JSON.parse(String(formData.get('orderUkraine')))).toMatchObject({
      InvNumber: 'INV-42',
      IsDirectFromSupplier: true,
      Supplier: { NetUid: 'supplier-1' },
    })
    expect(JSON.parse(String(formData.get('orderUkraine')))).not.toHaveProperty('TransportationType')
    expect(response.SupplyOrderUkraine?.NetUid).toBe('ukraine-order-1')
  })

  it('keeps direct Ukraine orders on the direct supply-order file endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce({
      SupplyOrder: { NetUid: 'direct-order-1' },
    })

    const response = await uploadDirectSupplyOrderFromFile({
      file: new File(['xlsx'], 'direct-order.xlsx'),
      parseConfiguration: createDirectParseConfiguration(),
      supplyOrder: createDirectSupplyOrder(),
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/orders/new/file', {
      body: expect.any(FormData),
      method: 'POST',
    })

    const formData = apiRequestMock.mock.calls[0]?.[1]?.body as FormData

    expect(formData.get('file')).toBeInstanceOf(File)
    expect(JSON.parse(String(formData.get('parseConfiguration')))).toMatchObject({
      UnitPriceColumnNumber: 5,
      VendorCodeColumnNumber: 1,
      WithTotalAmount: false,
    })
    expect(JSON.parse(String(formData.get('supplyOrder')))).toMatchObject({
      Client: { NetUid: 'supplier-1' },
      TransportationType: 0,
    })
    expect(formData.get('orderUkraine')).toBeNull()
    expect(response.SupplyOrder?.NetUid).toBe('direct-order-1')
  })
})

function createParseConfiguration(): UkraineOrderFromSupplierParseConfiguration {
  return {
    EndRow: 20,
    GrossWeightColumnNumber: 0,
    IsImportedProduct: 0,
    IsPricePerItem: true,
    IsWeightPerItem: false,
    QtyColumnNumber: 2,
    SpecificationCodeColumnNumber: 0,
    StartRow: 2,
    TotalAmountColumnNumber: 0,
    UnitPriceColumnNumber: 5,
    VendorCodeColumnNumber: 1,
    WeightColumnNumber: 0,
    WithGrossWeight: false,
    WithIsImportedProduct: false,
    WithSpecificationCode: false,
    WithWeight: false,
  }
}

function createOrderUkraine(): SupplyOrderUkraineSupplierCreatePayload {
  return {
    ClientAgreement: { NetUid: 'agreement-1' } as ClientAgreement,
    FromDate: '2026-06-07T10:00:00.000Z',
    InvDate: '2026-06-07T10:00:00.000Z',
    InvNumber: 'INV-42',
    IsDirectFromSupplier: true,
    Organization: { NetUid: 'organization-1' } as Organization,
    Supplier: { NetUid: 'supplier-1' } as Client,
  }
}

function createDirectParseConfiguration(): SupplyOrderDocumentParseConfiguration {
  return {
    EndRow: 20,
    GrossWeightColumnNumber: 0,
    IsWeightPerUnit: false,
    NetWeightColumnNumber: 0,
    ProductIsImported: false,
    QtyColumnNumber: 2,
    StartRow: 2,
    TotalAmountColumnNumber: 0,
    UnitPriceColumnNumber: 5,
    VendorCodeColumnNumber: 1,
    WithGrossWeight: false,
    WithNetWeight: false,
    WithTotalAmount: false,
  }
}

function createDirectSupplyOrder(): DirectSupplyOrderCreatePayload {
  return {
    Client: { NetUid: 'supplier-1' } as Client,
    ClientAgreement: { NetUid: 'agreement-1' } as ClientAgreement,
    DateFrom: '2026-06-07T10:00:00.000Z',
    Organization: { NetUid: 'organization-1' } as Organization,
    TransportationType: 0,
  }
}
