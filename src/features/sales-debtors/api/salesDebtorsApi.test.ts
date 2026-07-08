import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { TypeOfClientAgreement, TypeOfCurrencyOfAgreement } from '../types'
import { exportDebtorsDocument } from './salesDebtorsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('salesDebtorsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('exports debtors with the same days filter as the grid', async () => {
    apiRequestMock.mockResolvedValueOnce({ DocumentURL: 'https://example.test/debtors.xlsx' })

    await exportDebtorsDocument({
      days: 7,
      organizationNetId: 'organization-1',
      typeAgreement: TypeOfClientAgreement.All,
      typeCurrency: TypeOfCurrencyOfAgreement.EUR,
      userNetId: 'manager-1',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/debtors/document/export', {
      query: {
        days: 7,
        organizationNetId: 'organization-1',
        typeAgreement: TypeOfClientAgreement.All,
        typeCurrency: TypeOfCurrencyOfAgreement.EUR,
        userNetId: 'manager-1',
      },
    })
  })
})
