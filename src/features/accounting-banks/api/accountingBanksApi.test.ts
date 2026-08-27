import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getAccountingBanks, saveAccountingBank } from './accountingBanksApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

const apiRequestMock = vi.mocked(apiRequest)

describe('accounting banks permission-scoped API', () => {
  beforeEach(() => apiRequestMock.mockReset())

  it('uses the scoped page route for the registry', async () => {
    apiRequestMock.mockResolvedValueOnce([])
    await getAccountingBanks()
    expect(apiRequestMock).toHaveBeenCalledWith('/bank/accounting/all')
  })

  it.each([
    [{ Name: 'new' }, '/bank/accounting/create'],
    [{ Id: 7, Name: 'saved' }, '/bank/accounting/save'],
    [{ Deleted: true, Id: 7, Name: 'deleted' }, '/bank/accounting/delete'],
  ])('selects the exact mutation boundary', async (bank, route) => {
    apiRequestMock.mockResolvedValueOnce([])
    await saveAccountingBank(bank as never)
    expect(apiRequestMock).toHaveBeenCalledWith(route, { body: bank, method: 'POST' })
  })
})
