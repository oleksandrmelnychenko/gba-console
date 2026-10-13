import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { searchDatasetReportValues } from './reportsApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiRequest).mockResolvedValue([{ Id: '9223372036854775807', Name: 'Новий товар GBA' }]) })
const params = { value: '  GBA  ', offset: 0, limit: 30 }
it.each([[35, 0], [35, 1], [38, 0], [38, 1]] as const)('passes only explicit numeric mode %s/%s and preserves exact native IDs', async (source, mode) => {
  const signal = new AbortController().signal
  const result = await searchDatasetReportValues(source, 1, params, signal, undefined, undefined, undefined, mode)
  expect(apiRequest).toHaveBeenCalledWith('/report/datasets/lookup', { query: {
    dataSource: source, field: 1, value: 'GBA', offset: 0, limit: 30, profitReadMode: mode }, signal })
  expect(result[0].Id).toBe('9223372036854775807')
})
it.each([35, 38])('keeps omitted mode absent for saved source %s lookups', async source => {
  await searchDatasetReportValues(source, 1, params)
  expect(vi.mocked(apiRequest).mock.calls[0][1]?.query).not.toHaveProperty('profitReadMode')
})
it.each([null, '0', true, 2, {}])('rejects runtime nonnumeric or invalid mode %s before I/O', async mode => {
  await expect(searchDatasetReportValues(38, 1, params, undefined, undefined, undefined, undefined, mode as 0)).rejects.toThrow('джерело довідника')
  expect(apiRequest).not.toHaveBeenCalled()
})
it('rejects explicit profit mode on unrelated report lookups', async () => {
  await expect(searchDatasetReportValues(40, 29, params, undefined, undefined, undefined, undefined, 0)).rejects.toThrow('джерело довідника')
  expect(apiRequest).not.toHaveBeenCalled()
})
