import { beforeEach, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getReportHistory, getReportHistorySettings, parseReportHistoryPage } from './reportHistoryApi'

vi.mock('../../../shared/api/apiClient', async original => ({ ...await original<typeof import('../../../shared/api/apiClient')>(), apiRequest: vi.fn() }))

const ID = '22222222-2222-2222-2222-222222222222'
const data = { DataSource: 2, From: '2026-11-01', To: '2026-11-17', Sorted: { Row: [], Col: [], Measurements: [] }, Selections: [] }

beforeEach(() => vi.mocked(apiRequest).mockReset())

it('sends the period, report and user filters and reads day counts and entries', async () => {
  vi.mocked(apiRequest).mockResolvedValue({ IsHead: true, Total: 3, Offset: 0, Limit: 25,
    Days: [{ Day: '2026-11-17', Count: 2 }, { Day: '2026-11-16', Count: 1 }],
    Reports: [{ Report: '2:sales', DataSource: 2, Profile: 'sales', Kind: 'report', Count: 3 }],
    Items: [{ Id: ID, FormedAtUtc: '2026-11-17T08:30:00Z', DataSource: 2, Output: 'excel', RowCount: 12, Kind: 'report', Report: '2',
      UserNetId: '33333333-3333-3333-3333-333333333333', UserName: 'Іван Петренко', Own: false, Data: data }] })
  const page = await getReportHistory({ from: '2026-10-19', to: '2026-11-17', reports: ['2', '2:sales'], user: 'u-1' })
  expect(vi.mocked(apiRequest).mock.calls[0][0]).toBe('/report/history')
  expect(vi.mocked(apiRequest).mock.calls[0][1]?.query).toEqual({ from: '2026-10-19', to: '2026-11-17', offset: 0, limit: 25, reports: '2,2:sales', user: 'u-1' })
  expect(page.days).toEqual([{ day: '2026-11-17', count: 2 }, { day: '2026-11-16', count: 1 }])
  expect(page.items[0]).toMatchObject({ id: ID, output: 'excel', rowCount: 12, own: false, kind: 'report', report: '2', movement: null })
  expect(page.reports).toEqual([{ report: '2:sales', dataSource: 2, profile: 'sales', kind: 'report', count: 3 }])
  expect(page.items[0].data).toMatchObject({ dataSource: 2, from: '2026-11-01', to: '2026-11-17' })
})

it('keeps an entry whose settings can no longer be read, without its settings', () => {
  const page = parseReportHistoryPage({ IsHead: false, Total: 1, Days: [{ Day: '2026-11-17', Count: 1 }], Reports: [],
    Items: [{ Id: ID, FormedAtUtc: '2026-11-17T08:30:00Z', DataSource: 2, Output: 'screen', RowCount: 0, Kind: 'report', Report: '2',
      UserNetId: ID, UserName: '', Own: true, Data: null }] })
  expect(page.items[0].data).toBeNull()
})

it('rejects a malformed page', () => {
  expect(() => parseReportHistoryPage({ IsHead: false, Total: 1, Days: [{ Day: 'bad', Count: 1 }], Reports: [], Items: [] })).toThrow()
  expect(() => parseReportHistoryPage({ IsHead: false, Total: 1, Days: [], Reports: [], Items: [{ Id: ID, Kind: 'other' }] })).toThrow()
})

it('reads one entry settings in the saved-template shape', async () => {
  vi.mocked(apiRequest).mockResolvedValue({ Id: ID, Name: '', Revision: 1, UpdatedAtUtc: '2026-11-17T08:30:00Z', DataSource: 2,
    Output: 'screen', RowCount: 4, Kind: 'report', Data: data })
  const settings = await getReportHistorySettings(ID)
  expect(vi.mocked(apiRequest).mock.calls[0][0]).toBe(`/report/history/${ID}`)
  expect(settings).toMatchObject({ kind: 'report', data: { dataSource: 2, from: '2026-11-01' } })
})

it('reads a movement entry with the products and groups that still exist', async () => {
  const movement = { Version: 1, From: '2026-11-01', To: '2026-11-17', Levels: ['warehouse'], Measures: ['opening'],
    Filters: [{ Field: 'product', Ids: [7, 8] }] }
  vi.mocked(apiRequest).mockResolvedValue({ Id: ID, Name: '', Revision: 1, UpdatedAtUtc: '2026-11-17T08:30:00Z', DataSource: 1001,
    Output: 'excel', RowCount: 4, Kind: 'movement', Data: movement, Names: { Products: [{ Id: 7, Name: 'A-100', Detail: 'Фільтр' }], Groups: [] } })
  const settings = await getReportHistorySettings(ID)
  expect(settings).toEqual({ kind: 'movement', movement, products: [{ Id: 7, Name: 'A-100', Detail: 'Фільтр' }], groups: [] })
})
