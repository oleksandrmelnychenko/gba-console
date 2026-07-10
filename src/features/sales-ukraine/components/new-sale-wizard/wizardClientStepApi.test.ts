import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../../shared/api/apiClient'
import {
  getWizardClientAgreements,
  getWizardClientGroupedDebts,
  getWizardSalesRegister,
  mapWizardSaleRegisterItems,
  searchWizardClients,
  WIZARD_SALE_REGISTER_STATUS_ALL,
} from './wizardClientStepApi'

vi.mock('../../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('wizard client step API contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('searches clients through the targeted clients endpoint with limit and offset', async () => {
    apiRequestMock.mockResolvedValueOnce([{ NetUid: 'client-1' }])

    await expect(searchWizardClients('конкорд', 10, 20)).resolves.toEqual([{ NetUid: 'client-1' }])

    expect(apiRequestMock).toHaveBeenCalledWith('/clients/all/filtered', {
      query: {
        filterSql: 'RegionCode.Value/Client.FullName',
        limit: 10,
        offset: 20,
        value: 'конкорд',
      },
      signal: undefined,
    })
  })

  it('does not call the client search endpoint for blank wizard search values', async () => {
    await expect(searchWizardClients('   ', 10, 0)).resolves.toEqual([])

    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('requests the sales register with legacy query params', async () => {
    apiRequestMock.mockResolvedValueOnce([])

    await getWizardSalesRegister({
      clientNetId: 'client-1',
      from: '2026-06-03',
      to: '2026-06-10',
      type: WIZARD_SALE_REGISTER_STATUS_ALL,
      value: 'фільтр',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/sales/all/register', {
      query: {
        clientNetId: 'client-1',
        from: '2026-06-03',
        limit: 20,
        offset: 0,
        to: '2026-06-10',
        type: 6,
        value: 'фільтр',
      },
    })
  })

  it('maps register items keeping sales and wrapping sale returns', () => {
    const mapped = mapWizardSaleRegisterItems([
      { SaleStatistic: { Sale: { NetUid: 'sale-1' } } },
      { SaleReturn: { NetUid: 'return-1' } },
      {},
    ])

    expect(mapped).toEqual([
      { Sale: { NetUid: 'sale-1' } },
      { LifeCycleLine: [], Sale: null, SaleExchangeRates: [], SaleReturn: { NetUid: 'return-1' } },
    ])
  })

  it('requests grouped client debts by net id', async () => {
    apiRequestMock.mockResolvedValueOnce([{ Id: 1 }])

    await expect(getWizardClientGroupedDebts('client-1')).resolves.toEqual([{ Id: 1 }])
    expect(apiRequestMock).toHaveBeenCalledWith('/clients/get/debt/grouped', {
      query: { netId: 'client-1' },
    })
  })

  it('keeps only agreements with sales pricing for the sale wizard', async () => {
    apiRequestMock.mockResolvedValueOnce([
      {
        NetUid: 'provider-only-agreement',
        Agreement: {
          NetUid: 'agreement-provider-only',
          IsActive: true,
          ProviderPricing: { Id: 48682, Name: 'ЦЗ' },
        },
      },
      {
        NetUid: 'sales-agreement',
        Agreement: {
          NetUid: 'agreement-sales',
          IsActive: true,
          PricingId: 849,
          Pricing: { Id: 849, Name: 'ЦО2' },
        },
      },
    ])

    await expect(getWizardClientAgreements('client-1')).resolves.toEqual([
      {
        NetUid: 'sales-agreement',
        Agreement: {
          NetUid: 'agreement-sales',
          IsActive: true,
          PricingId: 849,
          Pricing: { Id: 849, Name: 'ЦО2' },
        },
      },
    ])
    expect(apiRequestMock).toHaveBeenCalledWith('/agreements/client/all', {
      query: { netId: 'client-1' },
    })
  })
})
