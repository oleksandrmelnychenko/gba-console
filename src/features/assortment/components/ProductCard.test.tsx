import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  getProduct,
  getProductAnalytics,
  getProductRegions,
  getProductSubstitutes,
} from '../api/assortmentApi'
import type { ProductDetail } from '../types'
import { ProductCard } from './ProductCard'

vi.mock('../api/assortmentApi', () => ({
  getProduct: vi.fn(),
  getProductAnalytics: vi.fn(),
  getProductRegions: vi.fn(),
  getProductSubstitutes: vi.fn(),
}))

vi.mock('./ProductSalesAnalytics', () => ({
  ProductSalesAnalytics: () => <div data-testid="sales-analytics" />,
}))

describe('ProductCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getProduct).mockResolvedValue(buildProduct())
    vi.mocked(getProductAnalytics).mockResolvedValue({} as never)
    vi.mocked(getProductSubstitutes).mockResolvedValue({
      ...history(),
      candidates: [],
      count: 0,
      found: true,
      in_stock_count: 0,
      product_id: 18_286,
    })
    vi.mocked(getProductRegions).mockResolvedValue({
      ...history(),
      count: 0,
      product_id: 18_286,
      regions: [],
      window_days: 365,
    })
  })

  it('explains the product scores and empty states in business language', async () => {
    render(
      <MantineProvider>
        <I18nProvider>
          <ProductCard productId={18_286} />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(await screen.findByText('Амортизатор')).toBeTruthy()
    expect(screen.getByText('Загальна оцінка: 21/100')).toBeTruthy()
    expect(screen.getByText('Що рекомендує система')).toBeTruthy()
    expect(screen.getByText('Перевірити залишок без продажів')).toBeTruthy()
    expect(screen.getByText('Товар давно не продавався')).toBeTruthy()
    expect(screen.getByText('Залишок на складі')).toBeTruthy()
    expect(screen.getByText('Запасу вистачить')).toBeTruthy()
    expect(screen.getByText('Загальна оцінка товару')).toBeTruthy()
    expect(screen.getByText('Попит на товар')).toBeTruthy()
    expect(screen.getByText('Прибутковість і повернення')).toBeTruthy()
    expect(screen.getByText('Внесок у продажі: низький (клас C)')).toBeTruthy()
    expect(screen.getByText('Регулярність попиту: нерегулярний (клас Z)')).toBeTruthy()
    expect(screen.getByText('Стан запасу: без продажів')).toBeTruthy()
    expect(screen.getByText('Стадія попиту: без продажів')).toBeTruthy()
    expect(screen.getByText('Повернень не було')).toBeTruthy()
    expect(screen.getByText('Замінників у наявності не знайдено.')).toBeTruthy()
    expect(screen.getByText('За обраний період продажів у регіонах не було.')).toBeTruthy()
    expect(screen.queryByText(/^Health$/)).toBeNull()
    expect(screen.queryByText(/^ABC C$/)).toBeNull()
    expect(screen.queryByText(/^XYZ Z$/)).toBeNull()
    expect(screen.queryByText(/мертвий/)).toBeNull()
  })
})

function buildProduct(): ProductDetail {
  return {
    ...history(),
    abc: 'C',
    action_label: 'dead_stock_review',
    action_reasons: ['dead_stock'],
    annual_units: 0,
    avg_price_eur: null,
    band: 'dead',
    cover_days: null,
    demand_components: {
      abc: 0.2,
      stability: 0.3,
      stock: 0,
      trend: 0,
    },
    demand_score: 16,
    eur_value: 114,
    found: true,
    health: 21,
    health_components: {
      abc: 0.2,
      margin: 0.5,
      returns: 1,
      stability: 0.3,
      stock: 0,
      trend: 0,
    },
    lifecycle: 'dead',
    margin_components: {
      abc: 0.2,
      margin: 0.5,
      returns: 1,
    },
    margin_pct: null,
    margin_score: 57,
    name: 'Амортизатор',
    primary_producer_id: 7,
    primary_producer_name: 'SEM OTOMOTIV DIS TICARET LTD.STI.',
    product_id: 18_286,
    qty_on_hand: 4,
    return_rate: 0,
    revenue_eur: 0,
    unit_cost_eur: 28.39,
    vendor_code: 'SEM18286',
    xyz: 'Z',
  }
}

function history() {
  return {
    as_of: '2026-07-25',
    effective_start: '2025-07-25',
    history_complete: true,
    history_fingerprint: 'products-history-20250101',
    history_windows: {
      annual: {
        effective_days: 365,
        effective_start: '2025-07-25',
        history_complete: true,
        requested_start: '2025-07-25',
        source_history_start: '2025-01-01',
      },
    },
    requested_start: '2025-07-25',
    source_history_start: '2025-01-01',
  }
}
