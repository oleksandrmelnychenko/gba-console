import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { searchDatasetReportValues } from './reportsApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())
it('requests only genuine Fenix source attribute keys with the original caller signal', async () => {
  const abort = new AbortController(); api.mockResolvedValue([{ Id: 'region:0042', Name: 'B' }])
  await expect(searchDatasetReportValues(41, 61, { value: '', offset: 0, limit: 30 }, abort.signal, 1)).resolves.toEqual([{ Id: 'region:0042', Name: 'B' }])
  expect(api).toHaveBeenCalledExactlyOnceWith('/report/datasets/lookup', { query: { dataSource: 41, field: 61,
    value: '', offset: 0, limit: 30, sourceWorld: 1 }, signal: abort.signal })
})
it('refuses absent/wrong source world before any request and rejects local numeric manager substitutions', async () => {
  const params = { value: '', offset: 0, limit: 30 }
  await expect(searchDatasetReportValues(41, 60, params)).rejects.toThrow(/Fenix/)
  await expect(searchDatasetReportValues(41, 60, params, undefined, 2)).rejects.toThrow(/Fenix/)
  expect(api).not.toHaveBeenCalled(); api.mockResolvedValue([{ Id: '1', Name: 'Local user' }])
  await expect(searchDatasetReportValues(41, 60, params, undefined, 1)).rejects.toThrow(/некоректні/)
})
it('retains duplicate captions with distinct source keys while refusing duplicate identities', async () => {
  const params = { value: '', offset: 0, limit: 30 }
  const rows = [{ Id: 'A'.repeat(32), Name: 'Same caption' }, { Id: 'B'.repeat(32), Name: 'Same caption' }]
  api.mockResolvedValue(rows); await expect(searchDatasetReportValues(41, 60, params, undefined, 1)).resolves.toEqual(rows)
  api.mockResolvedValue([rows[0], rows[0]])
  await expect(searchDatasetReportValues(41, 60, params, undefined, 1)).rejects.toThrow(/неоднозначні/)
})
