import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { purchasesCapability, purchasesParty, purchasesResponse } from '../testing/originalPurchasesFixtures'
import { purchasesRequest } from '../data/originalPurchases'
import { getPurchasesCapability, readPurchases, readPurchasesChoices } from './originalPurchasesApi'
import { namedPurchasesResponse, purchasesNamedChoices, purchasesNamedScope } from '../testing/originalPurchasesNamedFixtures'
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
it('posts canonical scoped names with the same caller signal and detached original request', async () => {
  vi.clearAllMocks(); const stop = new AbortController(), request = purchasesNamedScope()
  vi.mocked(apiRequest).mockResolvedValue(purchasesNamedChoices(request))
  expect((await readPurchasesChoices(request, stop.signal)).HumanChoicesAvailable).toBe(false)
  const [route, options] = vi.mocked(apiRequest).mock.calls[0]
  expect(route).toBe('/report/originals/purchases/choices'); expect(options).toEqual({ method: 'POST', body: request, dedupe: false, signal: stop.signal })
  expect(options?.body).not.toBe(request)
})
it('does not expose late choices from another original date range or family', async () => {
  vi.clearAllMocks(); const request = purchasesNamedScope(), names = purchasesNamedChoices()
  vi.mocked(apiRequest).mockResolvedValue({ ...names, Through: '2026-09-13' }); await expect(readPurchasesChoices(request)).rejects.toThrow()
  names.Choices.Контрагент[0].TableReference = '00000054'; vi.mocked(apiRequest).mockResolvedValue(names)
  await expect(readPurchasesChoices(request)).rejects.toThrow()
})
it('detaches named field witnesses before preview and rejects stale current parent evidence', async () => {
  vi.clearAllMocks(); const request = purchasesNamedScope(); request.Counterparties = [purchasesParty]; request.NamedChoiceWitnesses = { Контрагент: 'c'.repeat(64) }
  vi.mocked(apiRequest).mockResolvedValue(namedPurchasesResponse(request)); await readPurchases(request)
  const body = vi.mocked(apiRequest).mock.calls[0][1]?.body as typeof request
  request.NamedChoiceWitnesses.Контрагент = 'd'.repeat(64); expect(body.NamedChoiceWitnesses?.Контрагент).toBe('c'.repeat(64))
  await expect(readPurchases(request)).rejects.toThrow()
  await expect(readPurchases({ ...request, NamedChoiceWitnesses: { Контрагент: 'not-a-witness' } })).rejects.toThrow()
  expect(apiRequest).toHaveBeenCalledTimes(2)
})
