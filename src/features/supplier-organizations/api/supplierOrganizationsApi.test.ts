import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createSupplyOrganization,
  createSupplierOrganization,
  createSupplierOrganizationAgreement,
  createSupplyOrganizationAgreement,
  deleteSupplyOrganization,
  exportSupplyOrganizations,
  getSupplierOrganizationCashFlow,
  getSupplierOrganizationOverviewDetails,
  getSupplierOrganizationSettlementsCashFlow,
  getSupplierOrganizationSettlementsDetails,
  getSupplierOrganizationsRegistry,
  getSupplierOrganizationCurrencies,
  getSupplierOrganizationsOwners,
  getSupplyOrganization,
  getSupplyOrganizations,
  editSupplierOrganization,
  editSupplierOrganizationAgreement,
  searchSupplyOrganizations,
  searchSupplierOrganizationsRegistry,
  removeSupplierOrganization,
  updateSupplyOrganization,
  updateSupplyOrganizationAgreement,
} from './supplierOrganizationsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('supplierOrganizationsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads supplier organizations through the paged search endpoint by default', async () => {
    apiRequestMock.mockResolvedValueOnce([{ NetUid: 'supplier-1' }])

    await expect(getSupplyOrganizations()).resolves.toEqual([{ NetUid: 'supplier-1', SupplyOrganizationAgreements: [] }])

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/organizations/all/search', {
      query: {
        from: undefined,
        limit: undefined,
        offset: undefined,
        to: undefined,
        value: '',
      },
    })
  })

  it('loads filtered supplier organizations through the paged search endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce([{ NetUid: 'supplier-1' }])

    await expect(getSupplyOrganizations({
      from: '2025-01-17',
      limit: 40,
      offset: 80,
    })).resolves.toEqual([{ NetUid: 'supplier-1', SupplyOrganizationAgreements: [] }])

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/organizations/all/search', {
      query: {
        from: '2025-01-17',
        limit: 40,
        offset: 80,
        to: undefined,
        value: '',
      },
    })
  })

  it('trims supplier organization search values and keeps pagination params', async () => {
    apiRequestMock.mockResolvedValueOnce([{ NetUid: 'supplier-1' }])

    await expect(searchSupplyOrganizations('  service  ', '', {
      limit: 40,
      offset: 0,
    })).resolves.toEqual([{ NetUid: 'supplier-1', SupplyOrganizationAgreements: [] }])

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/organizations/all/search', {
      query: {
        from: undefined,
        limit: 40,
        offset: 0,
        organizationNetId: '',
        to: undefined,
        value: 'service',
      },
    })
  })

  it('loads one supplier by a trimmed identifier and normalizes an object envelope', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Data: {
        Name: 'Постачальник',
        NetUid: 'supplier-1',
        SupplyOrganizationAgreements: [{ NetUid: 'agreement-1' }],
      },
    })

    await expect(getSupplyOrganization(' supplier-1 ')).resolves.toEqual({
      Name: 'Постачальник',
      NetUid: 'supplier-1',
      SupplyOrganizationAgreements: [{
        NetUid: 'agreement-1',
        SupplyOrganizationDocuments: [],
      }],
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/organizations/get', {
      query: { netId: 'supplier-1' },
    })
  })

  it('uses permission-scoped registry and separate overview/settlements read routes', async () => {
    apiRequestMock.mockResolvedValueOnce([{ NetUid: 'supplier-1' }])
    apiRequestMock.mockResolvedValueOnce([{ NetUid: 'supplier-2' }])
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'supplier-1' })
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'supplier-1' })
    apiRequestMock.mockResolvedValueOnce({ AccountingCashFlowHeadItems: [] })

    await getSupplierOrganizationsRegistry({ limit: 40, offset: 0 })
    await searchSupplierOrganizationsRegistry(' service ', '', { limit: 40, offset: 40 })
    await getSupplierOrganizationOverviewDetails(' supplier-1 ')
    await getSupplierOrganizationSettlementsDetails(' supplier-1 ')
    await getSupplierOrganizationSettlementsCashFlow({
      from: '2026-07-01',
      netId: ' agreement-1 ',
      to: '2026-07-24',
      typePaymentTask: 2,
    })

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/supplies/organizations/registry', {
      query: {
        from: undefined,
        limit: 40,
        offset: 0,
        organizationNetId: '',
        to: undefined,
        value: '',
      },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/supplies/organizations/registry', {
      query: {
        from: undefined,
        limit: 40,
        offset: 40,
        organizationNetId: '',
        to: undefined,
        value: 'service',
      },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(3, '/supplies/organizations/overview/details', {
      query: { netId: 'supplier-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(4, '/supplies/organizations/settlements/details', {
      query: { netId: 'supplier-1' },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(5, '/supplies/organizations/settlements/cash-flow', {
      query: {
        from: '2026-07-01',
        netId: 'agreement-1',
        to: '2026-07-24',
        typePaymentTask: 2,
      },
    })
  })

  it('filters malformed supplier records instead of exposing them to forms', async () => {
    apiRequestMock.mockResolvedValueOnce([
      { Unexpected: true },
      { Name: 'Валідний постачальник' },
    ])
    apiRequestMock.mockResolvedValueOnce({ Unexpected: true })

    await expect(getSupplyOrganizations()).resolves.toEqual([{
      Name: 'Валідний постачальник',
      SupplyOrganizationAgreements: [],
    }])
    await expect(getSupplyOrganization('supplier-1')).resolves.toBeNull()
  })

  it('creates and updates suppliers through their CRUD endpoints', async () => {
    const created = {
      Id: 1,
      Name: 'Новий постачальник',
      NetUid: 'supplier-1',
    }
    apiRequestMock.mockResolvedValueOnce(created)
    apiRequestMock.mockResolvedValueOnce({ Data: { ...created, Name: 'Оновлений постачальник' } })

    await expect(createSupplyOrganization({
      Name: 'Новий постачальник',
    })).resolves.toEqual({
      ...created,
      SupplyOrganizationAgreements: [],
    })

    await expect(updateSupplyOrganization({
      ...created,
      Name: 'Оновлений постачальник',
    })).resolves.toEqual({
      ...created,
      Name: 'Оновлений постачальник',
      SupplyOrganizationAgreements: [],
    })

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/supplies/organizations/new', {
      body: { Name: 'Новий постачальник' },
      method: 'POST',
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/supplies/organizations/update', {
      body: {
        ...created,
        Name: 'Оновлений постачальник',
      },
      method: 'POST',
    })
  })

  it('deletes a supplier only with a non-empty trimmed identifier', async () => {
    apiRequestMock.mockResolvedValueOnce(undefined)

    await deleteSupplyOrganization(' supplier-1 ')

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/organizations/delete', {
      method: 'DELETE',
      query: { netId: 'supplier-1' },
    })
  })

  it('uses separate permission-scoped create and remove routes', async () => {
    apiRequestMock.mockResolvedValueOnce({ Name: 'Scoped supplier', NetUid: 'supplier-1' })
    apiRequestMock.mockResolvedValueOnce(undefined)

    await createSupplierOrganization({ Name: 'Scoped supplier' })
    await removeSupplierOrganization(' supplier-1 ')

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/supplies/organizations/create', {
      body: { Name: 'Scoped supplier' },
      method: 'POST',
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/supplies/organizations/remove', {
      method: 'DELETE',
      query: { netId: 'supplier-1' },
    })
  })

  it('uses a separate permission-scoped supplier edit route', async () => {
    const supplier = { Id: 1, Name: 'Edited supplier', NetUid: 'supplier-1' }
    apiRequestMock.mockResolvedValueOnce(supplier)

    await editSupplierOrganization(supplier)

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/organizations/edit', {
      body: supplier,
      method: 'POST',
    })
  })

  it('creates and updates agreements as multipart requests, including files', async () => {
    const agreement = {
      Currency: { Id: 2, Code: 'EUR' },
      ExistFrom: '2026-07-24',
      ExistTo: '2027-07-24',
      Name: 'Основний договір',
      Organization: { Id: 3, Name: 'GBA' },
      SupplyOrganizationId: 1,
    }
    const file = new File(['contract'], 'contract.pdf', { type: 'application/pdf' })
    apiRequestMock.mockResolvedValueOnce({ ...agreement, Id: 10 })
    apiRequestMock.mockResolvedValueOnce({ ...agreement, NetUid: 'agreement-1' })

    await createSupplyOrganizationAgreement(agreement, [file])
    await updateSupplyOrganizationAgreement({
      ...agreement,
      ExistFrom: '2026-07-24T00:00:00Z',
      ExistTo: '2027-07-24T00:00:00Z',
      NetUid: 'agreement-1',
    })

    expect(apiRequestMock).toHaveBeenCalledTimes(2)

    const createOptions = apiRequestMock.mock.calls[0][1]
    const createBody = createOptions?.body
    expect(apiRequestMock.mock.calls[0][0]).toBe('/supplies/organizations/agreement/new')
    expect(createOptions?.method).toBe('POST')
    expect(createBody).toBeInstanceOf(FormData)
    expect((createBody as FormData).get('agreementInString')).toBe(JSON.stringify(agreement))
    expect((createBody as FormData).getAll('files')).toEqual([file])

    const updateOptions = apiRequestMock.mock.calls[1][1]
    const updateBody = updateOptions?.body
    expect(apiRequestMock.mock.calls[1][0]).toBe('/supplies/organizations/agreement/update')
    expect(updateOptions?.method).toBe('POST')
    expect(updateBody).toBeInstanceOf(FormData)
    expect((updateBody as FormData).getAll('files')).toEqual([])
  })

  it('uses separate permission-scoped agreement create and edit routes', async () => {
    const agreement = {
      Currency: { Id: 2, Code: 'EUR' },
      Name: 'Основний договір',
      Organization: { Id: 3, Name: 'GBA' },
      SupplyOrganizationId: 1,
    }
    const file = new File(['contract'], 'contract.pdf', { type: 'application/pdf' })
    apiRequestMock.mockResolvedValueOnce({ ...agreement, Id: 10 })
    apiRequestMock.mockResolvedValueOnce({ ...agreement, Id: 10 })

    await createSupplierOrganizationAgreement(agreement, [file])
    await editSupplierOrganizationAgreement({ ...agreement, Id: 10 }, [])

    expect(apiRequestMock.mock.calls[0][0]).toBe('/supplies/organizations/agreement/create')
    expect(apiRequestMock.mock.calls[0][1]?.method).toBe('POST')
    expect(apiRequestMock.mock.calls[0][1]?.body).toBeInstanceOf(FormData)
    expect(apiRequestMock.mock.calls[1][0]).toBe('/supplies/organizations/agreement/edit')
    expect(apiRequestMock.mock.calls[1][1]?.method).toBe('POST')
    expect(apiRequestMock.mock.calls[1][1]?.body).toBeInstanceOf(FormData)
  })

  it('loads lookup collections and exports the trimmed current filter', async () => {
    apiRequestMock.mockResolvedValueOnce({ Currencies: [{ Id: 1, Code: 'UAH' }] })
    apiRequestMock.mockResolvedValueOnce({ Organizations: [{ Id: 2, Name: 'GBA' }] })
    apiRequestMock.mockResolvedValueOnce({
      Data: {
        DocumentURL: '/files/suppliers.xlsx',
        PdfDocumentURL: '/files/suppliers.pdf',
      },
    })

    await expect(getSupplierOrganizationCurrencies()).resolves.toEqual([{ Id: 1, Code: 'UAH' }])
    await expect(getSupplierOrganizationsOwners()).resolves.toEqual([{ Id: 2, Name: 'GBA' }])
    await expect(exportSupplyOrganizations(' supplier ', {
      from: '2026-07-01',
      to: '2026-07-24',
    })).resolves.toEqual({
      DocumentURL: '/files/suppliers.xlsx',
      PdfDocumentURL: '/files/suppliers.pdf',
    })

    expect(apiRequestMock).toHaveBeenNthCalledWith(3, '/supplies/organizations/document', {
      query: {
        from: '2026-07-01',
        to: '2026-07-24',
        value: 'supplier',
      },
    })
  })

  it('loads and normalizes supplier cash flow', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Data: {
        AccountingCashFlowHeadItems: null,
        CurrentAmount: 12,
      },
    })

    await expect(getSupplierOrganizationCashFlow({
      from: '2026-07-01',
      netId: ' agreement-1 ',
      to: '2026-07-24',
      typePaymentTask: 0,
    })).resolves.toEqual({
      AccountingCashFlowHeadItems: [],
      CurrentAmount: 12,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/accounting/cashflow/get/filtered', {
      query: {
        from: '2026-07-01',
        netId: 'agreement-1',
        to: '2026-07-24',
        typePaymentTask: 0,
      },
    })
  })

  it('rejects malformed CRUD input before making a request', async () => {
    await expect(getSupplyOrganizations({ limit: 0 })).rejects.toThrow('Ліміт')
    await expect(getSupplyOrganization('   ')).rejects.toThrow('ідентифікатор')
    await expect(createSupplyOrganization({ Name: '   ' })).rejects.toThrow('назву')
    await expect(updateSupplyOrganization({ Name: 'Постачальник' })).rejects.toThrow('ідентифікатора')
    await expect(deleteSupplyOrganization('')).rejects.toThrow('ідентифікатор')
    await expect(createSupplyOrganizationAgreement({
      Name: 'Договір',
    }, [])).rejects.toThrow('прив’язано')
    await expect(getSupplierOrganizationCashFlow({
      from: '2026-07-25',
      netId: 'supplier-1',
      to: '2026-07-24',
      typePaymentTask: 0,
    })).rejects.toThrow('раніше')

    expect(apiRequestMock).not.toHaveBeenCalled()
  })
})
