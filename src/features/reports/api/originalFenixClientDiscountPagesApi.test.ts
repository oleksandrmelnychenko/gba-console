import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { fenixChoicePageRequest } from '../data/originalFenixClientDiscountPages'
import { fenixCatalogue, fenixChoicePage } from '../testing/originalFenixClientDiscountPagesFixtures'
import { fenixScope } from '../testing/originalFenixClientDiscountsFixtures'
import { readFenixDiscountChoiceCatalogue, readFenixDiscountChoicePage } from './originalFenixClientDiscountPagesApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('loads only the own bounded catalogue route with original cancellation and no old witness assertion', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue(fenixCatalogue()); const controller = new AbortController()
  await readFenixDiscountChoiceCatalogue({ ...fenixScope(), ChoicesWitnessSha256: 'b'.repeat(64) }, controller.signal)
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/fenix/client-discounts/choices/catalogue', { method: 'POST', body: fenixScope(), dedupe: false, signal: controller.signal })
})
it('posts bounded exact search/page/header/full-universe witness and selected membership to own route', async () => {
  vi.clearAllMocks(); const catalogue = fenixCatalogue(), query = fenixChoicePageRequest(fenixScope().Through, catalogue, 'Номенклатура', '', 0), controller = new AbortController()
  vi.mocked(apiRequest).mockResolvedValue(fenixChoicePage(query, catalogue)); await readFenixDiscountChoicePage(query, catalogue, controller.signal)
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/fenix/client-discounts/choices/page', { method: 'POST', body: query, dedupe: false, signal: controller.signal })
})
it('rejects an unbounded limit, foreign scope and stale witness before dispatch', async () => {
  vi.clearAllMocks(); const catalogue = fenixCatalogue(), query = fenixChoicePageRequest(fenixScope().Through, catalogue, 'Номенклатура', '', 0)
  for (const bad of [{ ...query, Limit: 101 }, { ...query, Scope: { ...query.Scope, World: 'amg' as const } }, { ...query, InputWitnessSha256: 'd'.repeat(64) }])
    await expect(readFenixDiscountChoicePage(bad as typeof query, catalogue)).rejects.toThrow()
  expect(apiRequest).not.toHaveBeenCalled()
})
