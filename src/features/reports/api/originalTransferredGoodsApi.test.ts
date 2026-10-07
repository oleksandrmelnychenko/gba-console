import { expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { capability, response } from '../testing/transferredGoodsFixtures'
import { transferredRequest } from '../data/originalTransferredGoods'
import { getTransferredCapability, readTransferred } from './originalTransferredGoodsApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
it('transferred API sends explicit own POST scope without source access or deduplication', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue(response()); const controller = new AbortController()
  const query = transferredRequest(capability, '2026-09-01', '2026-09-30'); const result = await readTransferred(query, controller.signal)
  expect(result.Available).toBe(true); expect(apiRequest).toHaveBeenCalledWith('/report/originals/transferred-goods/preview',
    { method: 'POST', body: query, dedupe: false, signal: controller.signal })
})
it('transferred capability refuses a foreign server original before exposing generation', async () => {
  vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue({ ...capability, SourceId: 'other' }); await expect(getTransferredCapability()).rejects.toThrow()
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/transferred-goods/capabilities?world=fenix', { signal: undefined })
})

it('transferred optional receipt API preserves the same full compound keys and validates returned point evidence', async () => {
  vi.clearAllMocks()
  const { pointCapability, pointResponse, pointReceipt } = await import('../testing/receiptPointFixtures')
  const query = transferredRequest(pointCapability, '2026-09-01', '2026-09-30', [], [pointReceipt], true)
  vi.mocked(apiRequest).mockResolvedValue(pointResponse())
  expect((await readTransferred(query)).ReceiptCaptions?.PointReadCode).toBe('PointCurrentComplete')
  expect(apiRequest).toHaveBeenCalledWith('/report/originals/transferred-goods/preview', { method: 'POST', body: query, dedupe: false, signal: undefined })
  const forged = pointResponse(); delete forged.ReceiptCaptions!.PointHeaderWitnessSha256
  vi.mocked(apiRequest).mockResolvedValue(forged); await expect(readTransferred(query)).rejects.toThrow()
})
