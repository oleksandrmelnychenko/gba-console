import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { getPriceRecommendation, PricingContractError, searchCompetitorPrices } from './pricingApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)
const PRODUCT_NET_ID = '11111111-1111-1111-1111-111111111111'
const AGREEMENT_NET_ID = '22222222-2222-2222-2222-222222222222'

function recommendation() {
  return {
    product_id: 42,
    product_net_uid: PRODUCT_NET_ID,
    client_agreement_netuid: AGREEMENT_NET_ID,
    currency: 'EUR',
    baseline_price: 100.01,
    baseline_source: 'agreement',
    recommended_price: 95.01,
    price_floor: 80.01,
    unit_cost_eur: 60.01,
    suggested_discount_pct: 5,
    discount_band: { min_pct: 2, target_pct: 5, max_pct: 8 },
    peer_band: { p25: 90.01, p50: 95.01, p75: 99.01, n: 12 },
    confidence: 'high',
    margin_pct_at_recommended: 36.84,
    elasticity: 1.5,
    elasticity_source: 'per-sku',
    elastic_optimal_price: 180.03,
    rationale: 'peer-median',
    source_history_start: '2025-01-01',
    requested_start: '2025-07-25',
    effective_start: '2025-07-25',
    history_complete: true,
    history_fingerprint: 'pricing-history-20250101',
    model_fingerprint: 'pricing-ab-v2-history-20250101',
    as_of_date: '2026-07-25',
    model_version: 'pricing-ab-v2',
  }
}

describe('pricingApi canonical AI contract', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('preserves the product identity echo and cent-precise money fields', async () => {
    apiRequestMock.mockResolvedValueOnce(recommendation())

    await expect(getPriceRecommendation(PRODUCT_NET_ID, AGREEMENT_NET_ID)).resolves.toMatchObject({
      product_id: 42,
      product_net_uid: PRODUCT_NET_ID,
      client_agreement_netuid: AGREEMENT_NET_ID,
      recommended_price: 95.01,
      price_floor: 80.01,
      peer_band: { p25: 90.01, p50: 95.01, p75: 99.01, n: 12 },
      source_history_start: '2025-01-01',
      effective_start: '2025-07-25',
      history_complete: true,
    })
    expect(apiRequestMock).toHaveBeenCalledWith('/pricing/recommend', {
      query: {
        productNetId: PRODUCT_NET_ID,
        clientAgreementNetId: AGREEMENT_NET_ID,
        culture: 'uk',
        withVat: true,
      },
    })
  })

  it('fails closed on identity drift, fractional cents, and non-monotone bands', async () => {
    const identityDrift = recommendation()
    identityDrift.product_net_uid = '33333333-3333-3333-3333-333333333333'
    apiRequestMock.mockResolvedValueOnce(identityDrift)
    await expect(getPriceRecommendation(PRODUCT_NET_ID, AGREEMENT_NET_ID))
      .rejects.toBeInstanceOf(PricingContractError)

    const fractionalCent = recommendation()
    fractionalCent.recommended_price = 95.001
    apiRequestMock.mockResolvedValueOnce(fractionalCent)
    await expect(getPriceRecommendation(PRODUCT_NET_ID, AGREEMENT_NET_ID))
      .rejects.toBeInstanceOf(PricingContractError)

    const invalidBand = recommendation()
    invalidBand.discount_band = { min_pct: 8, target_pct: 5, max_pct: 2 }
    apiRequestMock.mockResolvedValueOnce(invalidBand)
    await expect(getPriceRecommendation(PRODUCT_NET_ID, AGREEMENT_NET_ID))
      .rejects.toBeInstanceOf(PricingContractError)
  })

  it('normalizes the Ukrainian competitor scan contract', async () => {
    apiRequestMock.mockResolvedValueOnce({
      ai_summary: 'Ринкова медіана стабільна.',
      currency: 'UAH',
      market: 'UA',
      offers: [{
        availability: 'in_stock',
        delivery_text: '1–2 дні',
        marketplace_name: 'STRANS',
        original_price_uah: 1500,
        price_uah: 1399,
        seller_name: 'Тестовий продавець',
        similarity_score: 0.96,
        source: 'strans',
        title: 'Точний товар',
        url: 'https://strans-shop.com.ua/shop/product/887756',
      }],
      query: 'OE-123',
      searched_at: '2026-07-31T11:30:00Z',
      sources_scanned: ['strans'],
    })

    const controller = new AbortController()
    await expect(searchCompetitorPrices({
      market: 'UA',
      product_net_uid: PRODUCT_NET_ID,
      query: '  OE-123  ',
      sources: ['strans'],
    }, controller.signal)).resolves.toMatchObject({
      currency: 'UAH',
      market: 'UA',
      offers: [{ price_uah: 1399, similarity_score: 0.96, source: 'strans' }],
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/pricing/competitors/search', {
      body: {
        market: 'UA',
        product_net_uid: PRODUCT_NET_ID,
        query: 'OE-123',
        sources: ['strans'],
      },
      method: 'POST',
      signal: controller.signal,
    })
  })
})
