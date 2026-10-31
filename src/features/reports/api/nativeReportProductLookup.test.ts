import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { REPORT_PRODUCT_LOOKUP_SOURCES, type ReportProductLookupSource } from '../data/productLookupCapability'
import { searchNativeReportProducts } from './nativeReportProductLookup'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => { api.mockReset() })
it.each(REPORT_PRODUCT_LOOKUP_SOURCES)('uses required report%i scope with canonical exact ID and only minimal raw fields', async source => {
  const row = { Id: '9007199254740993', Name: 'Сирий опис [123]', VendorCode: 'SKU' }
  api.mockResolvedValue([row]);const controller = new AbortController()
  expect(await searchNativeReportProducts(source, { exactId: row.Id }, controller.signal)).toEqual([row])
  expect(api).toHaveBeenCalledWith('/report/datasets/products/lookup', { query: { dataSource: source, exactId: row.Id, offset: 0, limit: 30 }, signal: controller.signal })
})
it.each(['123', 'id:123', "%_'", 'Відбійник ресори', 'SEM14631'])('sends literal name/SKU query %s without an ID heuristic or advanced-product route', async value => {
  api.mockResolvedValue([])
  await searchNativeReportProducts(3, { value, offset: 30 })
  expect(api).toHaveBeenCalledWith('/report/datasets/products/lookup', { query: { dataSource: 3, value, offset: 30, limit: 30 }, signal: undefined })
})
it.each([undefined, 0, 4, 35, '3', 3.5])('rejects an unsupported or noncanonical report owner before transport %j', async source => {
  await expect(searchNativeReportProducts(source as ReportProductLookupSource, {})).rejects.toThrow()
  expect(api).not.toHaveBeenCalled()
})
it.each([{ exactId: '01' }, { exactId: '1', value: 'abc' }, { exactId: '1', offset: 1 }, { exactId: '9223372036854775808' }, { limit: 51 }, { offset: -1 }])('rejects invalid query before transport %j', async query => {
  await expect(searchNativeReportProducts(3, query)).rejects.toThrow()
  expect(api).not.toHaveBeenCalled()
})
it.each([
  { response: [{ Id: 9007199254740992, Name: 'Rounded', VendorCode: '' }] },
  { response: [{ Id: '1', Name: 'X', VendorCode: '' }, { Id: '1', Name: 'X', VendorCode: '' }] },
  { response: [{ Id: '2', Name: 'Wrong', VendorCode: '' }] },
  { response: [{ Id: '1', Name: null, VendorCode: '' }] },
])('rejects unsafe, duplicate, wrong-ID or malformed raw rows $response', async ({ response }) => {
  api.mockResolvedValue(response)
  await expect(searchNativeReportProducts(3, { exactId: '1' })).rejects.toThrow()
})
it('keeps empty raw labels and Int64 maximum without fabricating a localized name', async () => {
  const row = { Id: '9223372036854775807', Name: '', VendorCode: '' };api.mockResolvedValue([row])
  expect(await searchNativeReportProducts(45, { exactId: row.Id })).toEqual([row])
})
it('never falls back to another transport after shared-route authorization failure', async () => {
  api.mockRejectedValue(new Error('403'))
  await expect(searchNativeReportProducts(3, { value: 'SEM14631' })).rejects.toThrow('403')
  expect(api).toHaveBeenCalledOnce();expect(api.mock.calls[0][0]).toBe('/report/datasets/products/lookup')
})
