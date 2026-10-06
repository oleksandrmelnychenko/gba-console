import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { availabilityRequest } from '../data/originalCashAvailability'
import { availabilityCapabilityFixture, availabilityResultFixture, availabilityPoint } from '../data/originalCashAvailability.fixtures'
import { getOriginalCashAvailabilityCapability, readOriginalCashAvailability } from './originalCashAvailabilityApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('uses dedicated authenticated OUR route and exact DateKon body with cancellation and no request coalescing', async () => {
  vi.clearAllMocks(); const capability = availabilityCapabilityFixture(), request = availabilityRequest(capability, availabilityPoint, [], [], false), signal = new AbortController().signal
  vi.mocked(apiRequest).mockResolvedValueOnce(capability).mockResolvedValueOnce(availabilityResultFixture(request))
  expect(await getOriginalCashAvailabilityCapability(signal)).toEqual(capability); expect(await readOriginalCashAvailability(request, signal)).toMatchObject({ Available: true })
  expect(apiRequest).toHaveBeenNthCalledWith(1, '/report/originals/cash-availability/capabilities?world=fenix', { signal })
  expect(apiRequest).toHaveBeenNthCalledWith(2, '/report/originals/cash-availability/preview', { method: 'POST', body: request, signal, dedupe: false })
})
it('rejects foreign capability policy and late response from another exact native point', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValueOnce({ ...availabilityCapabilityFixture(), EndpointPolicy: 'InclusiveCalendarWholeSeconds' }).mockResolvedValueOnce({ ...availabilityResultFixture(), DateKon: '2026-10-06T12:34:57' })
  await expect(getOriginalCashAvailabilityCapability()).rejects.toThrow(); await expect(readOriginalCashAvailability(availabilityRequest(availabilityCapabilityFixture(), availabilityPoint, [], [], false))).rejects.toThrow()
})
