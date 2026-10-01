import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { ORIGINAL_BUYER_SALES_SHARE_DEFINITIONS, createOriginalBuyerSalesShareRequest } from '../data/originalBuyerSalesShare'
import { originalBuyerSalesShareCapability, originalBuyerSalesShareReport } from '../data/originalBuyerSalesShare.test-fixtures'
import { getOriginalBuyerSalesShareCapabilities, previewOriginalBuyerSalesShare } from './originalBuyerSalesShareApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())
const variants = ['new', 'repeat'] as const
it.each(variants)('%s uses its dedicated capability and one caller-bound preview for detail, totals and XLSX/PDF', async variant => {
  const capability = originalBuyerSalesShareCapability(variant), result = originalBuyerSalesShareReport('2026-09', variant), controller = new AbortController()
  api.mockResolvedValueOnce(capability).mockResolvedValueOnce(result)
  expect(await getOriginalBuyerSalesShareCapabilities(variant, controller.signal)).toBe(capability)
  expect(await previewOriginalBuyerSalesShare(capability, '2026-09')).toBe(result)
  const route = ORIGINAL_BUYER_SALES_SHARE_DEFINITIONS[variant].Route
  expect(api).toHaveBeenNthCalledWith(1, `${route}/capabilities`, { signal: controller.signal })
  expect(api).toHaveBeenNthCalledWith(2, `${route}/preview`, { method: 'POST', body: createOriginalBuyerSalesShareRequest(capability, '2026-09'), dedupe: false })
})
it.each(variants)('%s makes no preview for disabled capabilities or invalid calendars', async variant => {
  await expect(previewOriginalBuyerSalesShare({ ...originalBuyerSalesShareCapability(variant), Executable: false }, '2026-09')).rejects.toThrow('Сервер не підтвердив')
  await expect(previewOriginalBuyerSalesShare(originalBuyerSalesShareCapability(variant), '2026-09-01')).rejects.toThrow('Оберіть місяць')
  expect(api).not.toHaveBeenCalled()
})
it.each(variants)('%s rejects the other original capability and files for another requested month', async variant => {
  api.mockResolvedValueOnce(originalBuyerSalesShareCapability(variant === 'new' ? 'repeat' : 'new')).mockResolvedValueOnce(originalBuyerSalesShareReport('2026-08', variant))
  await expect(getOriginalBuyerSalesShareCapabilities(variant)).rejects.toThrow('Сервер не підтвердив')
  await expect(previewOriginalBuyerSalesShare(originalBuyerSalesShareCapability(variant), '2026-09')).rejects.toThrow('інший місячний період')
})
