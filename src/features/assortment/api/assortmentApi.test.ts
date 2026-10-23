import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  getAssortmentHealth,
  getAssortmentOverview,
  getAssortmentStock,
  getAssortmentMargin,
  getAssortmentReturns,
  getProductSubstitutes,
  getProduct,
  getAssortmentRegions,
  getProductRegions,
  getProductAnalytics,
  ProductIntelligenceContractError,
} from './assortmentApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

beforeEach(() => {
  apiRequestMock.mockReset()
})

describe('assortment product analytics API', () => {
  it('omits the region window when no region filter is selected', async () => {
    apiRequestMock.mockResolvedValueOnce(historyResponse())

    await getAssortmentHealth({ regionWindowDays: 365 })

    expect(apiRequestMock).toHaveBeenCalledWith('/products/intelligence/assortment/health', {
      query: expect.objectContaining({
        regionId: undefined,
        regionWindowDays: undefined,
      }),
      signal: undefined,
    })
  })

  it('sends the region window together with a selected region', async () => {
    apiRequestMock.mockResolvedValueOnce(historyResponse())

    await getAssortmentHealth({ regionId: 7, regionWindowDays: 365 })

    expect(apiRequestMock).toHaveBeenCalledWith('/products/intelligence/assortment/health', {
      query: expect.objectContaining({
        regionId: 7,
        regionWindowDays: 365,
      }),
      signal: undefined,
    })
  })

  it('keeps the unknown-region selector distinct from no filter', async () => {
    apiRequestMock.mockResolvedValueOnce(historyResponse())
    await getAssortmentHealth({ regionId: 0, regionWindowDays: 30 })
    expect(apiRequestMock).toHaveBeenCalledWith('/products/intelligence/assortment/health', expect.objectContaining({ query: expect.objectContaining({ regionId: 0, regionWindowDays: 30 }) }))
  })

  it('rejects unproven financial semantics instead of displaying legacy totals', async () => {
    apiRequestMock.mockResolvedValueOnce({ ...historyResponse(), sales_basis: 'order-created' })
    await expect(getAssortmentOverview()).rejects.toBeInstanceOf(ProductIntelligenceContractError)
  })

  it('requires unknown monetary totals to remain null', async () => {
    const overview = { total_revenue_eur: 10, total_net_revenue_eur: null, known_total_net_revenue_eur: -2, unresolved_amount_count: 1 }
    apiRequestMock.mockResolvedValueOnce({ ...historyResponse(), overview })
    await expect(getAssortmentOverview()).resolves.toHaveProperty('overview.total_net_revenue_eur', null)
    apiRequestMock.mockResolvedValueOnce({ ...historyResponse(), overview: { ...overview, total_net_revenue_eur: 0 } })
    await expect(getAssortmentOverview()).rejects.toBeInstanceOf(ProductIntelligenceContractError)
  })

  it('accepts stock snapshots without requiring a sales amount contract', async () => {
    const response = { ...historyOnlyResponse(), history_windows: {
      dead: historyResponse().history_windows.portfolio,
      velocity: { ...historyResponse().history_windows.portfolio, requested_start: '2026-01-11', effective_start: '2026-01-11', effective_days: 180 },
    }, total_skus: 1, valued_skus: 1, unvalued_skus: 0,
      total_qty: 2, total_eur_value: 10, bands: { healthy: { count: 1, eur_value: 10, qty: 2 } },
      rows: [{ product_id: 42, qty_on_hand: 2, eur_value: 10, valuation_available: true, cover_days: 10, band: 'healthy' }] }
    apiRequestMock.mockResolvedValueOnce(response)
    await expect(getAssortmentStock()).resolves.toBe(response)
    apiRequestMock.mockResolvedValueOnce({ ...response, history_complete: false })
    await expect(getAssortmentStock()).rejects.toBeInstanceOf(ProductIntelligenceContractError)
  })

  it('accepts nonempty catalogue substitutes with stock-only candidate fields', async () => {
    const response = { ...historyOnlyResponse(), product_id: 42, found: true,
      target: { product_id: 42, name: 'Target', is_for_sale: true, has_analogue: true }, count: 1, in_stock_count: 1,
      candidates: [{ product_id: 43, name: 'Analogue', vendor_code: 'A43', oe_number: null,
        source: 'analogue', is_for_sale: true, in_stock: true, qty_on_hand: 2, band: 'healthy', health: 80, in_portfolio: true }] }
    apiRequestMock.mockResolvedValueOnce(response)
    await expect(getProductSubstitutes(42)).resolves.toBe(response)
  })

  it('accepts gross-only compact margin and return rankings but rejects malformed gross', async () => {
    const row = { product_id: 42, revenue_eur: 10, margin_pct: 0.2, margin_eur: 2,
      annual_units: 2, returned_units: 1, return_rate: 0.5 }
    const margin = { ...historyResponse(), leaders: [row], laggards: [row], negative: [], summary: {} }
    apiRequestMock.mockResolvedValueOnce(margin)
    await expect(getAssortmentMargin()).resolves.toBe(margin)
    const returns = { ...historyResponse(), high_returns: [row], summary: {} }
    apiRequestMock.mockResolvedValueOnce(returns)
    await expect(getAssortmentReturns()).resolves.toBe(returns)
    apiRequestMock.mockResolvedValueOnce({ ...returns, high_returns: [{ ...row, revenue_eur: null }] })
    await expect(getAssortmentReturns()).rejects.toBeInstanceOf(ProductIntelligenceContractError)
  })

  it('keeps full monetary validation on profile, health and both region endpoints', async () => {
    const row = { product_id: 42, region_id: null, revenue_eur: 10, net_revenue_eur: null,
      known_net_revenue_eur: 8, unresolved_amount_count: 1 }
    for (const [fetch, extra] of [
      [() => getProduct(42), { ...row, found: true }],
      [() => getAssortmentHealth(), { tasks: [row] }],
      [() => getAssortmentRegions(), { regions: [row] }],
      [() => getProductRegions(42), { regions: [row] }],
    ] as const) {
      const response = { ...historyResponse(), ...extra }
      apiRequestMock.mockResolvedValueOnce(response)
      await expect(fetch()).resolves.toBe(response)
      apiRequestMock.mockResolvedValueOnce(JSON.parse(JSON.stringify(response).replaceAll('"net_revenue_eur":null', '"net_revenue_eur":0')))
      await expect(fetch()).rejects.toBeInstanceOf(ProductIntelligenceContractError)
    }
    apiRequestMock.mockResolvedValueOnce({ ...historyResponse(), product_id: 42, found: true })
    await expect(getProduct(42)).rejects.toBeInstanceOf(ProductIntelligenceContractError)
    apiRequestMock.mockResolvedValueOnce({ ...historyResponse(), product_id: 42, found: false })
    await expect(getProduct(42)).resolves.toHaveProperty('found', false)
  })

  it('requests the monthly analytics contract with product id, period, and cancellation signal', async () => {
    const controller = new AbortController()
    const response = analyticsResponse()
    apiRequestMock.mockResolvedValueOnce(response)

    await expect(getProductAnalytics(42, '2026-07-10', 12, controller.signal)).resolves.toBe(response)
    expect(apiRequestMock).toHaveBeenCalledWith('/products/intelligence/product/42/analytics', {
      query: { asOfDate: '2026-07-10', months: 12 },
      signal: controller.signal,
    })
  })

  it('fails closed when analytics claims an inconsistent effective window', async () => {
    const response = analyticsResponse()
    response.window.effective_days = 342
    apiRequestMock.mockResolvedValueOnce(response)

    await expect(getProductAnalytics(42, '2026-07-10', 12)).rejects.toBeInstanceOf(
      ProductIntelligenceContractError,
    )
  })
})

function historyResponse() {
  return {
    time_zone: 'Europe/Kyiv',
    sales_basis: 'confirmed-invoices-gross-with-vat',
    net_sales_basis: 'confirmed-invoices-minus-active-returns-with-vat',
    import_completeness_confirmed: false,
    tasks: [],
    as_of: '2026-07-10',
    source_history_start: '2025-01-01',
    requested_start: '2025-07-10',
    effective_start: '2025-07-10',
    history_complete: true,
    history_fingerprint: 'products-history-20250101',
    history_windows: {
      portfolio: {
        source_history_start: '2025-01-01',
        requested_start: '2025-07-10',
        effective_start: '2025-07-10',
        effective_days: 365,
        history_complete: true,
      },
    },
  }
}

function analyticsResponse() {
  return {
    time_zone: 'Europe/Kyiv',
    sales_basis: 'confirmed-invoices-gross-with-vat',
    net_sales_basis: 'confirmed-invoices-minus-active-returns-with-vat',
    import_completeness_confirmed: false,
    as_of: '2026-07-10',
    source_history_start: '2025-01-01',
    requested_start: '2025-08-01',
    effective_start: '2025-08-01',
    history_complete: true,
    history_fingerprint: 'products-history-20250101',
    product_id: 42,
    sales_series: [],
    data_quality: {
      time_zone: 'Europe/Kyiv',
      revenue_basis: 'confirmed-invoices-gross-with-vat',
      net_sales_basis: 'confirmed-invoices-minus-active-returns-with-vat',
      import_completeness_confirmed: false,
      source_history_start: '2025-01-01',
      requested_start: '2025-08-01',
      effective_start: '2025-08-01',
      history_complete: true,
      zero_fill_begins_at: '2025-08-01',
    },
    window: {
      source_history_start: '2025-01-01',
      requested_start: '2025-08-01',
      effective_start: '2025-08-01',
      effective_days: 343,
      history_complete: true,
    },
  }
}

function historyOnlyResponse() {
  const { sales_basis: _sales, net_sales_basis: _net, time_zone: _zone,
    import_completeness_confirmed: _complete, ...history } = historyResponse()
  void [_sales, _net, _zone, _complete]
  return history
}
