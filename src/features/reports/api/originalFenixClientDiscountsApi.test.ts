import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { fenixChoices, fenixReadiness, fenixResult, fenixScope } from '../testing/originalFenixClientDiscountsFixtures'
import { getFenixDiscountReadiness, readFenixDiscountChoices, readFenixDiscounts } from './originalFenixClientDiscountsApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('calls the dedicated FENIX readiness route and preserves cancellation', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue(fenixReadiness); const controller = new AbortController()
  expect((await getFenixDiscountReadiness(controller.signal)).Executable).toBe(true)
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/fenix/client-discounts/readiness', { signal: controller.signal })
})
it('posts detached own date scope with dedupe disabled and strips old choice witness on reload', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue(fenixChoices()); const controller = new AbortController()
  await readFenixDiscountChoices({ ...fenixScope(), ChoicesWitnessSha256: 'b'.repeat(64) }, controller.signal)
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/fenix/client-discounts/choices', { method: 'POST', body: fenixScope(), dedupe: false, signal: controller.signal })
})
it('posts preview only to own FENIX endpoint and rejects a foreign response scope', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue(fenixResult()); await readFenixDiscounts(fenixScope())
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/fenix/client-discounts/preview', { method: 'POST', body: fenixScope(), dedupe: false, signal: undefined })
  vi.mocked(apiRequest).mockResolvedValue({ ...fenixResult(), World: 'amg' }); await expect(readFenixDiscounts(fenixScope())).rejects.toThrow()
})
