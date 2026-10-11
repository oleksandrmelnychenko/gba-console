import { afterEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getOriginalMatrixCapability, getOriginalMatrixScopeBinding, readOriginalMatrix, readScopedOriginalMatrix } from './originalVparivanieApi'
import { originalScopeBinding, originalScopeRequest, scopedMatrixFixture } from '../testing/originalVparivanieScopeFixtures'
import { matrixBindingRequest, originalMatrixScope } from '../data/originalVparivanieScope'
import { matrixCapability, matrixFixture, matrixWire } from '../testing/originalVparivanieFixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
afterEach(() => vi.clearAllMocks())
it('uses the authenticated original route and passes cancellation without substituting dataset 39', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce(matrixCapability()).mockResolvedValueOnce(matrixFixture())
  const controller = new AbortController(), request = matrixWire()
  await getOriginalMatrixCapability(controller.signal); const result = await readOriginalMatrix(request, controller.signal)
  expect(apiRequest).toHaveBeenNthCalledWith(1, '/report/originals/vparivanie/capabilities?world=fenix', { signal: controller.signal })
  expect(apiRequest).toHaveBeenNthCalledWith(2, '/report/originals/vparivanie/preview', { method: 'POST', body: request, signal: controller.signal, dedupe: false })
  expect(result.Rows[1].Values[2]).toBe('-9007199254740993.125')
})
it('rejects an otherwise complete response for another group', async () => {
  vi.mocked(apiRequest).mockResolvedValue({ ...matrixFixture(), GroupReference: 'E'.repeat(32) })
  await expect(readOriginalMatrix(matrixWire())).rejects.toThrow()
})
it('resolves the normal Source group under the authenticated route and posts only the original closed request', async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce(originalScopeBinding()).mockResolvedValueOnce(scopedMatrixFixture())
  const signal = new AbortController().signal, scope = originalMatrixScope(originalScopeRequest())
  const binding = await getOriginalMatrixScopeBinding(matrixCapability(), scope, signal)
  const result = await readScopedOriginalMatrix(binding, signal)
  expect(apiRequest).toHaveBeenNthCalledWith(1, '/report/originals/vparivanie/group', { signal,
    query: { world: 'fenix', from: '2025-01-01', through: '2026-10-09', groupId: 3569 } })
  expect(apiRequest).toHaveBeenNthCalledWith(2, '/report/originals/vparivanie/preview', { method: 'POST',
    body: matrixBindingRequest(binding), signal, dedupe: false })
  expect(result.ExactScopeAccepted).toBe(true); expect(result.OriginalFullTaskAccepted).toBe(false)
})
