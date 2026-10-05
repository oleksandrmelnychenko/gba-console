import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { amgChoices, amgReadiness, amgResult, amgScope } from '../testing/originalAmgClientDiscountsFixtures'
import { getAmgDiscountReadiness, readAmgDiscountChoices, readAmgDiscounts } from './originalAmgClientDiscountsApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('calls the dedicated AMG readiness route and preserves cancellation', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue(amgReadiness); const controller = new AbortController()
  expect((await getAmgDiscountReadiness(controller.signal)).Executable).toBe(true)
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/amg/client-discounts/readiness', { signal: controller.signal })
})
it('posts detached own date scope with dedupe disabled and strips old choice witness on reload', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue(amgChoices()); const controller = new AbortController()
  await readAmgDiscountChoices({ ...amgScope(), ChoicesWitnessSha256: 'b'.repeat(64) }, controller.signal)
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/amg/client-discounts/choices', { method: 'POST', body: amgScope(), dedupe: false, signal: controller.signal })
})
it('posts preview only to own AMG endpoint and rejects a foreign response scope', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue(amgResult()); await readAmgDiscounts(amgScope())
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/amg/client-discounts/preview', { method: 'POST', body: amgScope(), dedupe: false, signal: undefined })
  vi.mocked(apiRequest).mockResolvedValue({ ...amgResult(), World: 'fenix' }); await expect(readAmgDiscounts(amgScope())).rejects.toThrow()
})
