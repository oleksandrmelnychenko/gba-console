import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../../shared/api/apiClient'
import {
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

  it('searches clients via the legacy search query with limit and offset', async () => {
    apiRequestMock.mockResolvedValueOnce([{ NetUid: 'client-1' }])

    await expect(searchWizardClients('конкорд', 10, 20)).resolves.toEqual([{ NetUid: 'client-1' }])

    expect(apiRequestMock).toHaveBeenCalledTimes(1)
    const [path, options] = apiRequestMock.mock.calls[0]
    expect(path).toBe('/search/by/query')

    const filter = JSON.parse(String((options as { query: { filter: string } }).query.filter)) as {
      Filter: string
      Limit: number
      Offset: number
      Table: string
    }
    expect(filter.Table).toBe('Client')
    expect(filter.Limit).toBe(10)
    expect(filter.Offset).toBe(20)

    const innerFilter = JSON.parse(filter.Filter) as { FilterItem: { SQL: string; Type?: number }; Value: string }
    expect(innerFilter.Value).toBe('конкорд')
    expect(innerFilter.FilterItem.SQL).toBe('RegionCode.Value/Client.FullName')
    expect(innerFilter.FilterItem.Type).toBeUndefined()
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
})
