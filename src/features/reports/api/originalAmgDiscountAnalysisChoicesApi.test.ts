import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getAmgDiscountAnalysisReadiness, readAmgDiscountAnalysis, readAmgDiscountAnalysisChoices } from './originalAmgDiscountAnalysisApi'
import { amgNames, amgReadiness, amgChoiceWitness } from '../testing/originalAmgDiscountAnalysisChoicesFixtures'
import { amgResult, amgScope, amgParty } from '../testing/originalAmgDiscountAnalysisFixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('reads actual own readiness on its own route with cancellation and rejects a foreign world', async () => {
  vi.clearAllMocks(); const controller = new AbortController(); vi.mocked(apiRequest).mockResolvedValue(amgReadiness())
  expect((await getAmgDiscountAnalysisReadiness(controller.signal)).Executable).toBe(true)
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/amg/discount-analysis/readiness', { signal: controller.signal })
  vi.mocked(apiRequest).mockResolvedValue({ ...amgReadiness(), World: 'fenix' }); await expect(getAmgDiscountAnalysisReadiness()).rejects.toThrow()
})
it('posts own exact choices scope without deduplication and preserves the full offered universe', async () => {
  vi.clearAllMocks(); const controller = new AbortController(), request = { ...amgScope(), Counterparties: [amgParty] }, names = amgNames()
  names.RequestedCounterparties = [amgParty]; vi.mocked(apiRequest).mockResolvedValue(names)
  expect((await readAmgDiscountAnalysisChoices(request, controller.signal)).Choices.Номенклатура).toHaveLength(1)
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/amg/discount-analysis/choices', { method: 'POST', body: request, dedupe: false, signal: controller.signal })
})
it('binds filtered preview and exact result echo to the currently loaded own witness', async () => {
  vi.clearAllMocks(); const request = { ...amgScope(), Counterparties: [amgParty], ChoicesWitnessSha256: amgChoiceWitness }
  vi.mocked(apiRequest).mockResolvedValue(amgResult(request)); expect((await readAmgDiscountAnalysis(request)).ChoicesWitnessSha256).toBe(amgChoiceWitness)
  vi.mocked(apiRequest).mockResolvedValue({ ...amgResult(request), ChoicesWitnessSha256: 'e'.repeat(64) }); await expect(readAmgDiscountAnalysis(request)).rejects.toThrow()
})
it('refuses invalid scope before opening the network for choices', async () => {
  vi.clearAllMocks(); await expect(readAmgDiscountAnalysisChoices({ ...amgScope(), Through: '' })).rejects.toThrow(); expect(apiRequest).not.toHaveBeenCalled()
})
