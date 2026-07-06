import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  deleteSupplyProformDocument,
  searchSupplyOrderServiceOrganizations,
  uploadDirectSupplyOrderFromFile,
  uploadPackingListFile,
  uploadSupplyInvoiceFile,
  uploadSupplyOrderProformDocuments,
  uploadSupplyOrderUkraineFromSupplierFile,
} from './supplyUkraineOrdersApi'
import type {
  Client,
  ClientAgreement,
  DirectSupplyOrderCreatePayload,
  Organization,
  PackingListDocumentParseConfiguration,
  SupplyOrderDocumentParseConfiguration,
  SupplyProForm,
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

  it('uploads direct-order proform documents with the backend multipart contract', async () => {
    apiRequestMock.mockResolvedValueOnce({
      NetUid: 'direct-order-1',
      SupplyProForm: { NetUid: 'proform-1' },
    })

    const proForm: SupplyProForm = {
      NetUid: 'proform-1',
      Number: 'PF-42',
      ProFormDocuments: [{ FileName: 'proform.pdf', ContentType: 'application/pdf' }],
    }
    const file = new File(['pdf'], 'proform.pdf', { type: 'application/pdf' })

    const response = await uploadSupplyOrderProformDocuments({
      files: [file],
      orderNetId: 'direct-order-1',
      proForm,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/proforms/upload/documents', {
      body: expect.any(FormData),
      method: 'POST',
      query: { netId: 'direct-order-1' },
    })

    const formData = apiRequestMock.mock.calls[0]?.[1]?.body as FormData

    expect(formData.getAll('proFormFiles')).toEqual([file])
    expect(JSON.parse(String(formData.get('proForm')))).toMatchObject({
      NetUid: 'proform-1',
      Number: 'PF-42',
      ProFormDocuments: [{ FileName: 'proform.pdf' }],
    })
    expect(response?.SupplyProFormId).toBe('proform-1')
    expect(response?.SupplyProForm?.ProFormDocuments).toEqual([])
  })

  it('normalizes invoice upload responses that return the parent order', async () => {
    apiRequestMock.mockResolvedValueOnce({
      NetUid: 'direct-order-1',
      SupplyInvoices: [
        { NetUid: 'invoice-old', Number: 'INV-OLD' },
        { NetUid: 'invoice-new', Number: 'INV-NEW' },
      ],
    })

    const response = await uploadSupplyInvoiceFile({
      file: new File(['xlsx'], 'invoice.xlsx'),
      invoice: { Number: 'INV-NEW' },
      parseConfiguration: createDirectParseConfiguration(),
      supplyOrderNetId: 'direct-order-1',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/invoices/update/file', {
      body: expect.any(FormData),
      method: 'POST',
      query: { netId: 'direct-order-1' },
    })
    expect(response?.NetUid).toBe('invoice-new')
    expect(response?.Number).toBe('INV-NEW')
  })

  it('normalizes invoice upload responses that return a wrapped invoice', async () => {
    apiRequestMock.mockResolvedValueOnce({
      SupplyInvoice: { NetUid: 'invoice-wrapper', Number: 'INV-WRAP' },
    })

    const response = await uploadSupplyInvoiceFile({
      file: new File(['xlsx'], 'invoice.xlsx'),
      invoice: { Number: 'INV-WRAP' },
      parseConfiguration: createDirectParseConfiguration(),
      supplyOrderNetId: 'direct-order-1',
    })

    expect(response?.NetUid).toBe('invoice-wrapper')
    expect(response?.Number).toBe('INV-WRAP')
  })

  it('normalizes packing-list upload responses that return the parent invoice', async () => {
    apiRequestMock.mockResolvedValueOnce({
      NetUid: 'invoice-1',
      PackingLists: [
        { NetUid: 'pack-1', No: 'PL-1' },
        { NetUid: 'pack-2', No: 'PL-2' },
      ],
    })

    const response = await uploadPackingListFile({
      file: new File(['xlsx'], 'pack-list.xlsx'),
      packingList: { No: 'PL-2' },
      parseConfiguration: createPackListParseConfiguration(),
      supplyInvoiceNetId: 'invoice-1',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/packinglists/new/file', {
      body: expect.any(FormData),
      method: 'POST',
      query: { netId: 'invoice-1' },
    })
    expect(response?.NetUid).toBe('pack-2')
    expect(response?.No).toBe('PL-2')
  })

  it('normalizes packing-list upload responses that return a wrapped packing list', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Data: { NetUid: 'pack-wrapper', No: 'PL-WRAP' },
    })

    const response = await uploadPackingListFile({
      file: new File(['xlsx'], 'pack-list.xlsx'),
      packingList: { No: 'PL-WRAP' },
      parseConfiguration: createPackListParseConfiguration(),
      supplyInvoiceNetId: 'invoice-1',
    })

    expect(response?.NetUid).toBe('pack-wrapper')
    expect(response?.No).toBe('PL-WRAP')
  })

  it('deletes direct-order proform documents through the proforms document endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce(null)

    await deleteSupplyProformDocument('document-1')

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/proforms/delete/document', {
      method: 'DELETE',
      query: { netId: 'document-1' },
    })
  })

  it('searches service organizations with a bounded trimmed lookup query', async () => {
    apiRequestMock.mockResolvedValueOnce([{ NetUid: 'organization-1' }])

    await expect(searchSupplyOrderServiceOrganizations('  broker  ')).resolves.toEqual([{ NetUid: 'organization-1' }])

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/organizations/all/search', {
      query: {
        limit: 20,
        offset: 0,
        value: 'broker',
      },
    })
  })

  it('does not search service organizations for blank lookup values', async () => {
    await expect(searchSupplyOrderServiceOrganizations('   ')).resolves.toEqual([])

    expect(apiRequestMock).not.toHaveBeenCalled()
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
    WithTotalAmount: false,
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

function createPackListParseConfiguration(): PackingListDocumentParseConfiguration {
  return {
    EndRow: 20,
    GrossWeightColumnNumber: 7,
    IsWeightPerUnit: true,
    NetWeightColumnNumber: 6,
    QtyColumnNumber: 2,
    StartRow: 2,
    TotalAmountColumnNumber: 0,
    UnitPriceColumnNumber: 5,
    VendorCodeColumnNumber: 1,
    WithGrossWeight: true,
    WithNetWeight: true,
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
