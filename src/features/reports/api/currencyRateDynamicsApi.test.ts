import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { currencyDynamicsCapability, currencyDynamicsDefinition, currencyDynamicsReport } from '../data/currencyRateDynamics.test-fixtures'
import { getCurrencyRateDynamicsCapabilities, getCurrencyRateDynamicsDefinitions, previewCurrencyRateDynamics } from './currencyRateDynamicsApi'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())
it('uses dedicated capability, bounded ordered-pair search and one exact authenticated preview for both export links', async () => {
  const capability = currencyDynamicsCapability(), definition = currencyDynamicsDefinition(), response = currencyDynamicsReport(), controller = new AbortController()
  api.mockResolvedValueOnce(capability).mockResolvedValueOnce([definition]).mockResolvedValueOnce(response)
  expect(await getCurrencyRateDynamicsCapabilities(controller.signal)).toBe(capability)
  expect(await getCurrencyRateDynamicsDefinitions('USD', 25, 25, controller.signal)).toEqual([definition])
  expect(await previewCurrencyRateDynamics(capability, '2026-09', definition)).toBe(response)
  expect(api).toHaveBeenNthCalledWith(1, '/report/constructors/currency-rate-dynamics/capabilities', { signal: controller.signal })
  expect(api).toHaveBeenNthCalledWith(2, '/report/constructors/currency-rate-dynamics/rates?query=USD&offset=25&limit=25', { signal: controller.signal })
  expect(api).toHaveBeenNthCalledWith(3, '/report/constructors/currency-rate-dynamics/preview', { method: 'POST', dedupe: false,
    body: { Version: 1, SourceIdentity: capability.SourceIdentity, Month: '2026-09', RateDefinitionId: '9007199254740993' } })
  expect(api).toHaveBeenCalledTimes(3)
})
it('makes no request for invalid search paging, unavailable capability or an unproved definition', async () => {
  await expect(getCurrencyRateDynamicsDefinitions('', 10001, 25)).rejects.toThrow()
  await expect(getCurrencyRateDynamicsDefinitions('', 0, 51)).rejects.toThrow()
  await expect(previewCurrencyRateDynamics({ ...currencyDynamicsCapability(), Executable: false }, '2026-09', currencyDynamicsDefinition())).rejects.toThrow()
  await expect(previewCurrencyRateDynamics(currencyDynamicsCapability(), '2026-09', { ...currencyDynamicsDefinition(), RateDefinitionId: '0' })).rejects.toThrow()
  expect(api).not.toHaveBeenCalled()
})
it('rejects a result for a different exact definition even when its month and four labels match', async () => {
  api.mockResolvedValueOnce(currencyDynamicsReport('2026-09', currencyDynamicsDefinition(true)))
  await expect(previewCurrencyRateDynamics(currencyDynamicsCapability(), '2026-09', currencyDynamicsDefinition())).rejects.toThrow('іншу валютну пару')
})
