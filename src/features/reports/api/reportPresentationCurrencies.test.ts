import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportPresentationCurrencies } from './reportPresentationCurrencies'
import { currencySelection } from '../data/reportPresentationCurrency.test-fixtures'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const api = vi.mocked(apiRequest)
beforeEach(() => api.mockReset())
it('reads the active catalog without a fixed currency list or numeric-ID conversion', async () => {
  const rows = [ { NetUid: currencySelection.currencyNetUid, Code: 'CAD retail', Name: 'Канадський долар' },
    { NetUid: 'aaaaaaaa-2222-3333-4444-555555555555', Code: 'CHF', Name: 'Франк', Deleted: false },
    { NetUid: 'bbbbbbbb-2222-3333-4444-555555555555', Code: 'OLD', Deleted: true } ]
  api.mockResolvedValueOnce(rows)
  expect(await getReportPresentationCurrencies()).toEqual([
    { value: currencySelection.currencyNetUid, code: 'CAD retail', label: 'CAD retail — Канадський долар' },
    { value: 'aaaaaaaa-2222-3333-4444-555555555555', code: 'CHF', label: 'CHF — Франк' },
  ])
  expect(api).toHaveBeenCalledWith('/currencies/all', { signal: undefined })
})
it.each([{}, [{ NetUid: '42', Code: 'EUR' }], [{ NetUid: currencySelection.currencyNetUid, Code: 'EUR' }, { NetUid: currencySelection.currencyNetUid, Code: 'USD' }]])('refuses malformed/ambiguous catalogs without silently showing defaults %j', rows => {
  api.mockResolvedValueOnce(rows)
  return expect(getReportPresentationCurrencies()).rejects.toThrow()
})
