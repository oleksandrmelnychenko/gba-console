import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { deleteAmgDiscountVariant, listAmgDiscountVariants, loadAmgDiscountVariant, saveAmgDiscountVariant } from './originalAmgDiscountAnalysisVariantsApi'
import { amgVariant, amgVariantList, amgVariantId } from '../testing/originalAmgDiscountVariantFixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('reads only authenticated own route list and exact revisions with fresh cancellation context', async () => {
  vi.clearAllMocks(); const signal = new AbortController().signal; vi.mocked(apiRequest).mockResolvedValue(amgVariantList()); await listAmgDiscountVariants(signal)
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/amg/discount-analysis/variants', { signal, dedupe: false })
  vi.mocked(apiRequest).mockResolvedValue(amgVariant()); await loadAmgDiscountVariant(amgVariant(), signal)
  expect(apiRequest).toHaveBeenLastCalledWith(`/report/originals/amg/discount-analysis/variants/${amgVariantId}/revisions/1`, { signal, dedupe: false })
  vi.mocked(apiRequest).mockResolvedValue({ ...amgVariant(), Revision: 2 }); await expect(loadAmgDiscountVariant(amgVariant())).rejects.toThrow()
})
it('saves exact own scope with CAS and refuses a silently changed server definition', async () => {
  vi.clearAllMocks(); const request = { Id: null, Revision: 0, Name: 'Мій AMG', Scope: amgVariant().Scope }; vi.mocked(apiRequest).mockResolvedValue(amgVariant()); await saveAmgDiscountVariant(request)
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/amg/discount-analysis/variants/save', { method: 'POST', body: request, dedupe: false, signal: undefined })
  const changed = amgVariant(); changed.Scope.Request.Products = []; vi.mocked(apiRequest).mockResolvedValue(changed); await expect(saveAmgDiscountVariant(request)).rejects.toThrow()
})
it('deletes only exact valid own revision and rejects malformed route keys before network dispatch', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue({ Deleted: true }); await deleteAmgDiscountVariant(amgVariant())
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/amg/discount-analysis/variants/delete', { method: 'POST', body: { Id: amgVariantId, Revision: 1 }, dedupe: false, signal: undefined })
  vi.clearAllMocks(); await expect(loadAmgDiscountVariant({ Id: 'bad', Revision: 1 })).rejects.toThrow(); await expect(deleteAmgDiscountVariant({ Id: amgVariantId, Revision: 0 })).rejects.toThrow(); expect(apiRequest).not.toHaveBeenCalled()
})
