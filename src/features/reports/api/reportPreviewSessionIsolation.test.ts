import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { clearSession, saveSession } from '../../../shared/auth/session'
import { cashAggregateCapability, cashAggregateReport } from '../data/cashAggregateBalance.test-fixtures'
import { previewCashAggregateBalance } from './cashAggregateBalanceApi'
import { originalRevenueCapability, originalRevenueReport } from '../data/originalRevenue.test-fixtures'
import { previewOriginalRevenue } from './originalRevenueApi'
import { activeClientsCapability, activeClientsReport } from '../data/activeClients.test-fixtures'
import { currencyDynamicsCapability, currencyDynamicsDefinition, currencyDynamicsReport } from '../data/currencyRateDynamics.test-fixtures'
import { debtRatioCapability, debtRatioReport } from '../data/debtToSalesRatio.test-fixtures'
import type { ReportRequestBody } from '../types'
import { previewActiveClients } from './activeClientsApi'
import { previewCurrencyRateDynamics } from './currencyRateDynamicsApi'
import { previewDebtToSalesRatio } from './debtToSalesRatioApi'
import { createStockReport, previewStockReport } from './reportsApi'

const fetchMock = vi.fn()
const month = '2026-09'
const nativeRequest = (): ReportRequestBody => ({ from: `${month}-01`, to: `${month}-30`, selections: [],
  sorted: { Col: [], Measurements: [], Row: [] } })
const nativePayload = () => ({ Preview: { Version: 1, ResultSha256: 'b'.repeat(64), PresentationOnly: true,
  Page: { Offset: 0, Limit: 50, TotalVisibleRows: 0, ReturnedRows: 0, HasMore: false },
  RowSchema: [], ColumnSchema: [], Rows: [], Columns: [], Cells: [] } })
const cases = [
  { name: 'original revenue', route: '/report/constructors/revenue-comparison/preview',
    run: () => previewOriginalRevenue(originalRevenueCapability(), month), payload: originalRevenueReport },
  { name: 'cash aggregate', route: '/report/constructors/cash-aggregate-balance/preview',
    run: () => previewCashAggregateBalance(cashAggregateCapability(), '2026-09-30'), payload: cashAggregateReport },
  { name: 'currency dynamics', route: '/report/constructors/currency-rate-dynamics/preview',
    run: () => previewCurrencyRateDynamics(currencyDynamicsCapability(), month, currencyDynamicsDefinition()), payload: currencyDynamicsReport },
  { name: 'active clients', route: '/report/constructors/active-clients/preview',
    run: () => previewActiveClients(activeClientsCapability(), month), payload: activeClientsReport },
  { name: 'debt ratio', route: '/report/constructors/debt-to-sales-ratio/preview',
    run: () => previewDebtToSalesRatio(debtRatioCapability(), month), payload: debtRatioReport },
  { name: 'native generation', route: '/report/stocks/generate',
    run: async () => (await createStockReport(nativeRequest())).document, payload: nativePayload },
  { name: 'native preview', route: '/report/stocks/preview',
    run: async () => (await previewStockReport(nativeRequest())).result.document, payload: nativePayload },
]

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); clearSession() })
afterEach(() => { clearSession(); vi.unstubAllGlobals() })

it.each(cases)('$name does not join a previous caller pending request with identical report parameters', async ({ run, payload, route }) => {
  // Use the real apiClient and two deferred fetches, rather than an apiRequest mock.
  const releases: ((response: Response) => void)[] = []
  fetchMock.mockImplementation(() => new Promise<Response>(resolve => { releases.push(resolve) }))
  const response = (caller: string) => new Response(JSON.stringify({ Body: { ...payload(),
    DocumentURL: `/reports/${caller}.xlsx?signature=${caller}`, PdfDocumentURL: `/reports/${caller}.pdf?signature=${caller}` } }),
  { status: 200, headers: { 'Content-Type': 'application/json' } })
  saveSession({ userNetUid: 'caller-a', csrfToken: 'csrf-a' })
  const first = run()
  saveSession({ userNetUid: 'caller-b', csrfToken: 'csrf-b' })
  const second = run()
  try {
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [[urlA, optionsA], [urlB, optionsB]] = fetchMock.mock.calls as [string, RequestInit][]
    expect(new URL(urlA).pathname).toBe(`/api/v1/uk${route}`)
    expect(urlB).toBe(urlA)
    expect(optionsB.body).toBe(optionsA.body)
    expect(optionsA).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(optionsB).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(new Headers(optionsA.headers).get('X-CSRF-Token')).toBe('csrf-a')
    expect(new Headers(optionsB.headers).get('X-CSRF-Token')).toBe('csrf-b')
    releases[1](response('caller-b'))
    const current = await second
    expect(current.DocumentURL).toBe('/reports/caller-b.xlsx?signature=caller-b')
    expect(current.PdfDocumentURL).toBe('/reports/caller-b.pdf?signature=caller-b')
    releases[0](response('caller-a'))
    const previous = await first
    expect(previous.DocumentURL).toBe('/reports/caller-a.xlsx?signature=caller-a')
    expect(previous.PdfDocumentURL).toBe('/reports/caller-a.pdf?signature=caller-a')
  } finally {
    // Also settle both promises when the missing-isolation regression fails early.
    releases.forEach(release => release(response('cleanup')))
    await Promise.allSettled([first, second])
  }
})
