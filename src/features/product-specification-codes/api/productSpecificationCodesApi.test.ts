import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  changeProductSpecification,
  getProductSpecifications,
  uploadSpecificationCodesFile,
} from './productSpecificationCodesApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('product specification codes permission-scoped API', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads the page through the page-view facade', async () => {
    apiRequestMock.mockResolvedValueOnce([])

    await getProductSpecifications({
      vendorCode: '  A-1 ',
      specificationCode: ' 8708 ',
      locale: 'uk',
      limit: 20,
      offset: 0,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/specifications/page/get/all/filtered', {
      query: {
        vendorCode: 'A-1',
        specificationCode: '8708',
        locale: 'uk',
        limit: 20,
        offset: 0,
      },
    })
  })

  it('changes a code through the dedicated edit facade', async () => {
    const body = { NetUid: '11111111-1111-4111-8111-111111111111' }
    apiRequestMock.mockResolvedValueOnce(null)

    await changeProductSpecification({
      specificationChangeMode: 1,
      body,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/specifications/page/change', {
      method: 'POST',
      query: { specificationChangeMode: 1 },
      body,
    })
  })

  it('imports codes through the dedicated import facade', async () => {
    apiRequestMock.mockResolvedValueOnce({ ParsedCount: 1 })
    const file = new File(['code'], 'codes.xlsx')

    await uploadSpecificationCodesFile(file)

    expect(apiRequestMock).toHaveBeenCalledWith('/products/specification-codes/file/import', {
      body: expect.any(FormData),
      method: 'POST',
    })
    const request = apiRequestMock.mock.calls[0]?.[1]
    expect((request?.body as FormData).get('file')).toBe(file)
  })
})
