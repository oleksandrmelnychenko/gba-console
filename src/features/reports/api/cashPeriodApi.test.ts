import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getCashPeriodLegs } from './cashPeriodApi'
import { cashPeriodLeg } from '../data/cashPeriod.test-fixtures'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())

it('reads a bounded ordered page of exact native IDs and passes cancellation', async () => {
  const controller = new AbortController()
  api.mockResolvedValue([cashPeriodLeg])
  await expect(getCashPeriodLegs('0', 30, controller.signal)).resolves.toEqual([cashPeriodLeg])
  expect(api).toHaveBeenCalledWith('/report/datasets/40/currency-legs', {
    query: { afterId: '0', limit: 30 }, signal: controller.signal,
  })
})

it('refuses malformed, repeated and non-monotone exact IDs', async () => {
  api.mockResolvedValue([cashPeriodLeg, cashPeriodLeg])
  await expect(getCashPeriodLegs()).rejects.toThrow('повторні')
  api.mockResolvedValue([{ ...cashPeriodLeg, CurrencyRegisterId: '9223372036854775808' }])
  await expect(getCashPeriodLegs()).rejects.toThrow('ідентичності')
  api.mockResolvedValue([{ ...cashPeriodLeg, CurrencyRegisterNetUid: '00000000-0000-0000-0000-000000000000' }])
  await expect(getCashPeriodLegs()).rejects.toThrow('ідентичності')
  api.mockReset()
  await expect(getCashPeriodLegs('01')).rejects.toThrow('сторінка')
  await expect(getCashPeriodLegs('0', 51)).rejects.toThrow('сторінка')
  expect(api).not.toHaveBeenCalled()
})
