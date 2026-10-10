import { afterEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getOriginalMatrixCapability, readOriginalMatrix } from './originalVparivanieApi'
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
