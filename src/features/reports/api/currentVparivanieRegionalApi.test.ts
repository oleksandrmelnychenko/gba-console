import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { currentVparivanieDataset, exactSelection } from '../data/currentVparivanie.test-fixtures'
import { regionalDataset, regionalRequest, regionalResult } from '../data/currentVparivanieRegional.test-fixtures'
import { readCurrentVparivanieRegional } from './currentVparivanieRegionalApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))

it('requires the advertised current contract before a network call', async () => {
  vi.clearAllMocks()
  await expect(readCurrentVparivanieRegional(currentVparivanieDataset, regionalRequest())).rejects.toThrow('не підтримує')
  expect(apiRequest).not.toHaveBeenCalled()
})

it('posts the normal period/product/group/warehouse/buyer request and pins the returned dates', async () => {
  vi.clearAllMocks()
  const request = regionalRequest()
  request.selections.push(exactSelection(4, 6, ['100']), exactSelection(21, 2, ['2']), exactSelection(5, 0, ['10']))
  vi.mocked(apiRequest).mockResolvedValue(regionalResult())
  const value = await readCurrentVparivanieRegional(regionalDataset, request)
  expect(value.To).toBe('2026-10-31')
  expect(apiRequest).toHaveBeenCalledWith('/report/datasets/39/current-regional', {
    method: 'POST', body: request, signal: undefined,
  })
  vi.mocked(apiRequest).mockResolvedValue({ ...regionalResult(), From: '2026-09-03' })
  await expect(readCurrentVparivanieRegional(regionalDataset, request)).rejects.toThrow('неповну')
})

it('refuses an unsupported request before posting', async () => {
  vi.clearAllMocks()
  const request = regionalRequest(); request.to = '2028-10-31'
  await expect(readCurrentVparivanieRegional(regionalDataset, request)).rejects.toThrow('366')
  expect(apiRequest).not.toHaveBeenCalled()
})
