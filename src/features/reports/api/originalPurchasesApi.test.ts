import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { purchasesCapability, purchasesResponse } from '../testing/originalPurchasesFixtures'
import { purchasesRequest } from '../data/originalPurchases'
import { getPurchasesCapability, readPurchases } from './originalPurchasesApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('uses only own GET capability and POST preview with original abort signal and detached default scope', async () => {
  vi.clearAllMocks(); const stop = new AbortController(), request = purchasesRequest(purchasesCapability, '2026-09-10', '2026-09-12')
  vi.mocked(apiRequest).mockResolvedValueOnce(purchasesCapability).mockResolvedValueOnce(purchasesResponse())
  expect(await getPurchasesCapability(stop.signal)).toEqual(purchasesCapability)
  expect(apiRequest).toHaveBeenLastCalledWith('/report/originals/purchases/capabilities', { signal: stop.signal })
  expect((await readPurchases(request, stop.signal)).Available).toBe(true)
  const options = vi.mocked(apiRequest).mock.calls[1][1]
  expect(options).toEqual({ method: 'POST', body: request, dedupe: false, signal: stop.signal })
  expect(options?.body).not.toBe(request)
})
it('rejects the partial incoming-receipt capability and foreign response before exposure', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue({ ...purchasesCapability, DefinitionSha256: 'f'.repeat(64) })
  await expect(getPurchasesCapability()).rejects.toThrow()
  vi.mocked(apiRequest).mockResolvedValue({ ...purchasesResponse(), World: 'amg' })
  await expect(readPurchases(purchasesRequest(purchasesCapability, '2026-09-10', '2026-09-12'))).rejects.toThrow()
})
it('rejects opaque project fragments and invalid resource requests before API dispatch', async () => {
  vi.clearAllMocks(); const request = purchasesRequest(purchasesCapability, '2026-09-10', '2026-09-12')
  await expect(readPurchases({ ...request, Projects: ['A'.repeat(32)] })).rejects.toThrow()
  await expect(readPurchases({ ...request, Measures: [] })).rejects.toThrow(); expect(apiRequest).not.toHaveBeenCalled()
})
