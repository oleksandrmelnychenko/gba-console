import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  calculateCompanyCarRoadListForCreate,
  calculateCompanyCarRoadListForEdit,
  createCompanyCar,
  createCompanyCarRoadList,
  deleteCompanyCar,
  deleteCompanyCarRoadList,
  getCompanyCarForEdit,
  getCompanyCarForRoadLists,
  getCompanyCarRoadLists,
  getCompanyCars,
  searchCompanyCars,
  updateCompanyCar,
  updateCompanyCarRoadList,
} from './companyCarsApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

const apiRequestMock = vi.mocked(apiRequest)

describe('company-cars canonical routes', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue([])
  })

  it('uses independent page, car and road-list permission routes', async () => {
    await getCompanyCars()
    await searchCompanyCars('AA')
    await getCompanyCarForEdit('car-1')
    await getCompanyCarForRoadLists('car-1')
    await createCompanyCar({} as never)
    await updateCompanyCar({} as never)
    await deleteCompanyCar('car-1')
    await getCompanyCarRoadLists({ companyCarNetId: 'car-1', from: '2026-08-01', to: '2026-08-17' })
    await createCompanyCarRoadList({} as never)
    await updateCompanyCarRoadList({} as never)
    await calculateCompanyCarRoadListForCreate({} as never)
    await calculateCompanyCarRoadListForEdit({} as never)
    await deleteCompanyCarRoadList('road-list-1')

    expect(apiRequestMock.mock.calls.map(([route]) => route)).toEqual([
      '/consumables/company/cars/accounting/all',
      '/consumables/company/cars/accounting/all/search',
      '/consumables/company/cars/accounting/edit/details',
      '/consumables/company/cars/accounting/road-lists/details',
      '/consumables/company/cars/accounting/new',
      '/consumables/company/cars/accounting/update',
      '/consumables/company/cars/accounting/delete',
      '/consumables/company/cars/roadlists/accounting/all/filtered',
      '/consumables/company/cars/roadlists/accounting/new',
      '/consumables/company/cars/roadlists/accounting/update',
      '/consumables/company/cars/roadlists/accounting/create/calculate',
      '/consumables/company/cars/roadlists/accounting/edit/calculate',
      '/consumables/company/cars/roadlists/accounting/delete',
    ])
  })
})
