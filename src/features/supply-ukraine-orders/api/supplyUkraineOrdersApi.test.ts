import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  deleteSupplyProformDocument,
  getDirectSupplyUkraineOrders,
  getSupplyUkraineOrders,
  getSupplyOrderSuppliers,
  searchSupplyOrderServiceOrganizations,
  uploadDirectSupplyOrderFromFile,
  uploadPackingListDocuments,
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
const TEST_USER_NET_UID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

describe('supplyUkraineOrdersApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    localStorage.clear()
    localStorage.setItem('gba_console_session', JSON.stringify({
      userNetUid: TEST_USER_NET_UID,
    }))
  })

  it('includes the selected end date when loading both Ukraine order sources', async () => {
    apiRequestMock.mockResolvedValue({ Collection: [], TotalRowsQty: 0 })
    const params = {
      currencyId: '',
      from: '2026-07-17',
      limit: 20,
      offset: 0,
      supplierName: '',
      to: '2026-07-24',
    }

    await getSupplyUkraineOrders(params)
    await getDirectSupplyUkraineOrders(params)

    const expectedQuery = {
      currencyId: undefined,
      from: '2026-07-17',
      limit: 20,
      offset: 0,
      supplierName: '',
      to: '2026-07-24T23:59:59.999',
    }
    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/supplies/ukraine/order/all/filtered', {
      query: expectedQuery,
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/supplies/orders/all/uk/filtered', {
      query: expectedQuery,
    })
  })

  it('preserves an explicit end-of-range timestamp', async () => {
    apiRequestMock.mockResolvedValue({ Collection: [], TotalRowsQty: 0 })

    await getDirectSupplyUkraineOrders({
      currencyId: '2',
      from: '2026-07-17T00:00:00',
      limit: 50,
      offset: 10,
      supplierName: '  SEM  ',
      to: '2026-07-24T12:30:00',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/orders/all/uk/filtered', {
      query: {
        currencyId: 2,
        from: '2026-07-17T00:00:00',
        limit: 50,
        offset: 10,
        supplierName: 'SEM',
        to: '2026-07-24T12:30:00',
      },
    })
  })

  it('rejects a non-numeric currency value before it can become a NaN query parameter', async () => {
    await expect(getDirectSupplyUkraineOrders({
      currencyId: 'b196c411-99e5-41ae-92d2-c1f7ba94eb03',
      from: '2026-07-17',
      limit: 20,
      offset: 0,
      supplierName: '',
      to: '2026-07-24',
    })).rejects.toThrow('Currency filter must contain a positive numeric ID.')

    expect(apiRequestMock).not.toHaveBeenCalled()
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
      headers: {
        'Idempotency-Key': expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
        'X-Supply-Order-Ukraine-Supplier-File-Owner':
          TEST_USER_NET_UID,
      },
      method: 'POST',
      query: {
        operationNetUid: expect.any(String),
      },
    })

    const request = apiRequestMock.mock.calls[0]?.[1]
    const formData = request?.body as FormData
    const operationNetUid = new Headers(request?.headers).get('Idempotency-Key')

    expect(formData.get('file')).toBeInstanceOf(File)
    expect(request?.query?.operationNetUid).toBe(operationNetUid)
    expect(JSON.parse(String(formData.get('parseConfiguration')))).toMatchObject({
      IsPricePerItem: true,
      UnitPriceColumnNumber: 5,
      VendorCodeColumnNumber: 1,
    })
    expect(JSON.parse(String(formData.get('orderUkraine')))).toMatchObject({
      InvNumber: 'INV-42',
      IsDirectFromSupplier: true,
      Supplier: { Id: 31, NetUid: 'supplier-1' },
    })
    expect(JSON.parse(String(formData.get('orderUkraine')))).not.toHaveProperty('TransportationType')
    expect(JSON.parse(String(formData.get('orderUkraine'))).Supplier).not.toHaveProperty('FullName')
    expect(response.SupplyOrderUkraine?.NetUid).toBe('ukraine-order-1')
    expect(getSupplierFileRecoveryKeys()).toEqual([])
  })

  it('rejects a supplier-file request when the authenticated owner changes before send', async () => {
    const file = new File(['xlsx'], 'order.xlsx')
    vi.spyOn(file, 'arrayBuffer').mockImplementationOnce(async () => {
      localStorage.setItem('gba_console_session', JSON.stringify({
        userNetUid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      }))
      return new TextEncoder().encode('xlsx').buffer
    })

    await expect(uploadSupplyOrderUkraineFromSupplierFile({
      file,
      orderUkraine: createOrderUkraine(),
      parseConfiguration: createParseConfiguration(),
    })).rejects.toThrow(
      'Authenticated supplier-file order owner changed before the request was sent.',
    )

    expect(apiRequestMock).not.toHaveBeenCalled()
    expect(getSupplierFileRecoveryKeys()).toEqual([])
  })

  it('retains the immutable operation and reuses its key after a 504 unknown outcome', async () => {
    const timeout = { status: 504 }
    const file = new File(['same-xlsx-bytes'], 'order.xlsx', {
      lastModified: 1234,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    apiRequestMock
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce({
        SupplyOrderUkraine: { NetUid: 'ukraine-order-replayed' },
      })

    const payload = {
      file,
      orderUkraine: createOrderUkraine(),
      parseConfiguration: createParseConfiguration(),
    }

    await expect(
      uploadSupplyOrderUkraineFromSupplierFile(payload),
    ).rejects.toBe(timeout)

    const recoveryKey = getSupplierFileRecoveryKeys()[0]
    const pending = JSON.parse(localStorage.getItem(recoveryKey) || '{}') as {
      operationNetUid: string
      snapshot: {
        file: { digest: string }
        orderUkraine: Record<string, unknown>
      }
    }
    const firstOperation = new Headers(
      apiRequestMock.mock.calls[0]?.[1]?.headers,
    ).get('Idempotency-Key')

    expect(firstOperation).toBe(pending.operationNetUid)
    expect(pending.snapshot.file.digest).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(pending)).not.toContain('same-xlsx-bytes')
    expect(pending.snapshot.orderUkraine).not.toHaveProperty('Responsible')

    await expect(
      uploadSupplyOrderUkraineFromSupplierFile(payload),
    ).resolves.toMatchObject({
      SupplyOrderUkraine: { NetUid: 'ukraine-order-replayed' },
    })

    const secondOperation = new Headers(
      apiRequestMock.mock.calls[1]?.[1]?.headers,
    ).get('Idempotency-Key')
    expect(secondOperation).toBe(firstOperation)
    expect(getSupplierFileRecoveryKeys()).toEqual([])
  })

  it('deduplicates concurrent supplier-file submissions in flight', async () => {
    let resolveRequest: ((value: unknown) => void) | undefined
    apiRequestMock.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )
    const file = new File(['xlsx'], 'order.xlsx')
    const payload = {
      file,
      orderUkraine: createOrderUkraine(),
      parseConfiguration: createParseConfiguration(),
    }

    const first = uploadSupplyOrderUkraineFromSupplierFile(payload)
    const second = uploadSupplyOrderUkraineFromSupplierFile(payload)

    expect(second).toBe(first)
    await vi.waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1))
    resolveRequest?.({
      SupplyOrderUkraine: { NetUid: 'ukraine-order-1' },
    })
    await expect(first).resolves.toMatchObject({
      SupplyOrderUkraine: { NetUid: 'ukraine-order-1' },
    })
  })

  it('requires the same selected File object for an in-lifecycle unknown-outcome retry', async () => {
    apiRequestMock.mockRejectedValueOnce({ status: 500 })
    const firstFile = new File(['same'], 'order.xlsx', { lastModified: 42 })

    await expect(uploadSupplyOrderUkraineFromSupplierFile({
      file: firstFile,
      orderUkraine: createOrderUkraine(),
      parseConfiguration: createParseConfiguration(),
    })).rejects.toMatchObject({ status: 500 })

    await expect(uploadSupplyOrderUkraineFromSupplierFile({
      file: new File(['same'], 'order.xlsx', { lastModified: 42 }),
      orderUkraine: createOrderUkraine(),
      parseConfiguration: createParseConfiguration(),
    })).rejects.toThrow('same selected File object')
    expect(apiRequestMock).toHaveBeenCalledTimes(1)
    expect(getSupplierFileRecoveryKeys()).toHaveLength(1)
  })

  it('clears supplier-file recovery state after a definitive 409 conflict', async () => {
    apiRequestMock.mockRejectedValueOnce({ status: 409 })

    await expect(uploadSupplyOrderUkraineFromSupplierFile({
      file: new File(['xlsx'], 'order.xlsx'),
      orderUkraine: createOrderUkraine(),
      parseConfiguration: createParseConfiguration(),
    })).rejects.toMatchObject({ status: 409 })

    expect(getSupplierFileRecoveryKeys()).toEqual([])
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

  it('uploads packing-list documents with the legacy multipart field names', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Id: 42,
      NetUid: 'pack-42',
      InvoiceDocuments: [{ FileName: 'packing-list.pdf' }],
    })

    const file = new File(['pdf'], 'packing-list.pdf', { type: 'application/pdf' })
    const packingList = {
      Id: 42,
      NetUid: 'pack-42',
      InvoiceDocuments: [{
        ContentType: 'application/pdf',
        FileName: 'packing-list.pdf',
      }],
    }

    const response = await uploadPackingListDocuments(packingList, [file])

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/packinglists/upload/documents', {
      body: expect.any(FormData),
      method: 'POST',
    })

    const formData = apiRequestMock.mock.calls[0]?.[1]?.body as FormData

    expect(JSON.parse(String(formData.get('entity')))).toMatchObject(packingList)
    expect(formData.getAll('documents')).toEqual([file])
    expect(response?.InvoiceDocuments).toEqual([{ FileName: 'packing-list.pdf' }])
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

  it('deduplicates manufacturer dictionary rows by visible supplier identity', async () => {
    const polishAgreement: ClientAgreement = {
      NetUid: 'agreement-pl',
      Agreement: {
        NetUid: 'agreement-entity-pl',
        Organization: { NetUid: 'org-pl', Culture: 'pl', Name: 'Poland' },
      },
    }
    const ukrainianAgreement: ClientAgreement = {
      NetUid: 'agreement-uk',
      Agreement: {
        NetUid: 'agreement-entity-uk',
        Organization: { NetUid: 'org-uk', Culture: 'uk', Name: 'Ukraine' },
      },
    }

    apiRequestMock.mockResolvedValueOnce([
      {
        NetUid: 'supplier-without-uk-agreement',
        FullName: 'SEM OTOMOTIV',
        ClientAgreements: [polishAgreement],
      },
      {
        NetUid: 'supplier-with-uk-agreement',
        FullName: ' sem   otomotiv ',
        ClientAgreements: [ukrainianAgreement],
      },
      {
        NetUid: 'supplier-third-copy',
        FullName: 'SEM OTOMOTIV',
        ClientAgreements: [],
      },
      {
        NetUid: 'different-supplier',
        FullName: 'Other supplier',
        ClientAgreements: [ukrainianAgreement],
      },
    ])

    await expect(getSupplyOrderSuppliers()).resolves.toEqual([
      {
        NetUid: 'supplier-with-uk-agreement',
        FullName: ' sem   otomotiv ',
        ClientAgreements: [ukrainianAgreement],
      },
      {
        NetUid: 'different-supplier',
        FullName: 'Other supplier',
        ClientAgreements: [ukrainianAgreement],
      },
    ])
  })

  it('deduplicates manufacturer rows by the final select label when source keys differ', async () => {
    const ukrainianAgreement: ClientAgreement = {
      NetUid: 'agreement-uk',
      Agreement: {
        NetUid: 'agreement-entity-uk',
        Organization: { NetUid: 'org-uk', Culture: 'uk', Name: 'Ukraine' },
      },
    }

    apiRequestMock.mockResolvedValueOnce([
      {
        NetUid: 'supplier-with-code',
        FullName: 'Берешвілі Вадим Вікторович',
        USREOU: '3100401117',
        ClientAgreements: [ukrainianAgreement],
      },
      {
        NetUid: 'supplier-without-code',
        FullName: 'Берешвілі Вадим Вікторович',
        USREOU: '',
        ClientAgreements: [ukrainianAgreement],
      },
    ])

    await expect(getSupplyOrderSuppliers()).resolves.toEqual([
      {
        NetUid: 'supplier-with-code',
        FullName: 'Берешвілі Вадим Вікторович',
        USREOU: '3100401117',
        ClientAgreements: [ukrainianAgreement],
      },
    ])
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
    ClientAgreement: { Id: 32, NetUid: 'agreement-1' } as ClientAgreement,
    FromDate: '2026-06-07T10:00:00.000Z',
    InvDate: '2026-06-07T10:00:00.000Z',
    InvNumber: 'INV-42',
    IsDirectFromSupplier: true,
    Organization: { Id: 33, NetUid: 'organization-1' } as Organization,
    Supplier: { Id: 31, NetUid: 'supplier-1' } as Client,
  }
}

function getSupplierFileRecoveryKeys(): string[] {
  return Array.from(
    { length: localStorage.length },
    (_, index) => localStorage.key(index),
  ).filter(
    (key): key is string => Boolean(
      key?.startsWith('gba_console:supply-ukraine-supplier-file:v1:'),
    ),
  )
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
