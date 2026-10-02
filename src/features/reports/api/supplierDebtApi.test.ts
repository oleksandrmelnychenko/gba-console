import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { createSupplierDebtRequest } from '../data/supplierDebt'
import { supplierDebtCapability, supplierDebtReport } from '../data/supplierDebt.test-fixtures'
import { getSupplierDebtCapabilities, previewSupplierDebt } from './supplierDebtApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())
it('uses exact supplier capability and one authorized monthly preview with caller cancellation', async () => {
  const capability = supplierDebtCapability(), report = supplierDebtReport(), controller = new AbortController()
  api.mockResolvedValueOnce(capability).mockResolvedValueOnce(report)
  expect(await getSupplierDebtCapabilities(controller.signal)).toEqual(capability)
  expect(await previewSupplierDebt(capability, report.Month, controller.signal)).toBe(report)
  expect(api).toHaveBeenNthCalledWith(1, '/report/constructors/supplier-debt/capabilities', { signal: controller.signal, dedupe: false })
  expect(api).toHaveBeenNthCalledWith(2, '/report/constructors/supplier-debt/preview', { method: 'POST',
    body: createSupplierDebtRequest(capability, report.Month), signal: controller.signal, dedupe: false })
  expect(api).toHaveBeenCalledTimes(2)
})
it('does not submit an invalid period or unimplemented capability', async () => {
  await expect(previewSupplierDebt({ ...supplierDebtCapability(), RuntimeImplemented: false }, '2026-09')).rejects.toThrow('Сервер не підтвердив')
  await expect(previewSupplierDebt(supplierDebtCapability(), '2026-Q3')).rejects.toThrow('Оберіть допустимий')
  expect(api).not.toHaveBeenCalled()
})
it('refuses another period and does not retry refused or ambiguous previews', async () => {
  api.mockResolvedValueOnce(supplierDebtReport('2026-08'))
  await expect(previewSupplierDebt(supplierDebtCapability(), '2026-09')).rejects.toThrow('інший місячний період')
  api.mockRejectedValueOnce(new Error('Refused'))
  await expect(previewSupplierDebt(supplierDebtCapability(), '2026-09')).rejects.toThrow('Refused')
  expect(api).toHaveBeenCalledTimes(2)
})
