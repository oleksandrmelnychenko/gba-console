import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { ProductAnalytics, ProductSalesSeriesPoint } from '../types'
import { ProductSalesAnalytics } from './ProductSalesAnalytics'

const chartMocks = vi.hoisted(() => ({
  area: vi.fn(),
  bar: vi.fn(),
}))

vi.mock('@mantine/charts', () => ({
  AreaChart: (props: Record<string, unknown>) => {
    chartMocks.area(props)
    return <div data-testid="revenue-chart" />
  },
  BarChart: (props: Record<string, unknown>) => {
    chartMocks.bar(props)
    return <div data-testid="units-chart" />
  },
}))

beforeEach(() => {
  chartMocks.area.mockReset()
  chartMocks.bar.mockReset()
})

describe('ProductSalesAnalytics', () => {
  it('shows factual KPIs, a completed-month trend, and accessible charts', () => {
    renderAnalytics(buildAnalytics())

    expect(screen.getByText((_content, element) => element?.tagName === 'B' && element.textContent === '95 шт.')).toBeTruthy()
    expect(screen.getByText('100%')).toBeTruthy()
    expect(screen.getByText(/Останній місяць періоду неповний.*10\.07\.2026.*не включно/)).toBeTruthy()
    expect(screen.getByRole('img', { name: /Продані одиниці по місяцях.*2026-07: 5 шт/ })).toBeTruthy()
    expect(screen.getByRole('img', { name: /Фактична виручка по місяцях.*2026-07: 50 EUR/ })).toBeTruthy()
    expect(screen.getByTestId('units-chart')).toBeTruthy()
    expect(screen.getByTestId('revenue-chart')).toBeTruthy()
    expect(chartMocks.bar).toHaveBeenCalledWith(expect.objectContaining({
      dataKey: 'label',
      maxBarWidth: 28,
    }))
    expect(chartMocks.area).toHaveBeenCalledWith(expect.objectContaining({
      connectNulls: false,
      withGradient: false,
    }))
  })

  it('keeps the rest of the product card usable when sales analytics fails', () => {
    renderAnalytics(null, 'Products analytics API: 503')

    expect(screen.getByRole('alert').textContent).toContain('Products analytics API: 503')
    expect(screen.queryByTestId('units-chart')).toBeNull()
  })

  it('shows an incomplete current month in actuals but excludes it from the six-month trend', () => {
    const analytics = buildAnalytics()

    analytics.sales_series[6] = buildPoint(7, 1_000, false)
    renderAnalytics(analytics)

    expect(screen.getByText('100%')).toBeTruthy()
    expect(screen.getByRole('img', { name: /Продані одиниці по місяцях.*2026-07: 1\s000 шт/ })).toBeTruthy()
    expect(screen.getByText(/Останній місяць періоду неповний і не входить у порівняння тренду/)).toBeTruthy()
  })

  it('describes a resumed trend truthfully when the comparison baseline is zero', () => {
    const analytics = buildAnalytics()
    const units = [0, 0, 0, 5, 5, 5, 1]

    analytics.sales_series = units.map((value, index) => buildPoint(index + 1, value, index < 6))
    renderAnalytics(analytics)

    expect(screen.getByText(/Продажі відновилися/)).toBeTruthy()
    expect(screen.queryByText(/потрібно щонайменше шість завершених місяців/)).toBeNull()
  })

  it('keeps cents in a low quantity-weighted average price', () => {
    const analytics = buildAnalytics()

    analytics.sales_series = analytics.sales_series.map((point) => ({
      ...point,
      avg_price_eur: 0.25,
      revenue_eur: point.units * 0.25,
    }))
    renderAnalytics(analytics)

    expect(screen.getByText((_content, element) => (
      element?.tagName === 'B' && element.textContent?.replace(/\s/g, ' ') === '0,25 EUR'
    ))).toBeTruthy()
  })

  it('labels an incomplete historical cutoff without calling it the current month', () => {
    const analytics = buildAnalytics()

    analytics.as_of = '2024-03-15'
    analytics.window.end_exclusive = '2024-03-15'
    renderAnalytics(analytics)

    expect(screen.getByText(/дані до 15\.03\.2024, не включно/)).toBeTruthy()
    expect(screen.queryByText(/Поточний місяць/)).toBeNull()
  })

  it('rejects malformed chart points instead of passing NaN to charts', () => {
    const analytics = buildAnalytics()
    analytics.sales_series = [{ ...analytics.sales_series[0], month: 'invalid', units: Number.NaN }]

    renderAnalytics(analytics)

    expect(screen.getByText('За вибраний період немає даних продажів.')).toBeTruthy()
    expect(chartMocks.area).not.toHaveBeenCalled()
    expect(chartMocks.bar).not.toHaveBeenCalled()
  })
})

function renderAnalytics(analytics: ProductAnalytics | null, error: string | null = null) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <ProductSalesAnalytics analytics={analytics} error={error} />
      </I18nProvider>
    </MantineProvider>,
  )
}

function buildAnalytics(): ProductAnalytics {
  const units = [10, 10, 10, 20, 20, 20, 5]

  return {
    as_of: '2026-07-10',
    data_quality: {
      avg_price_basis: 'revenue_eur / units (quantity-weighted)',
      revenue_basis: 'actual lines',
      sales_date_field: 'Order.Created',
      sales_validity_filter: 'OrderItem.IsValidForCurrentSale = 1',
      sales_window_end: 'exclusive',
      stock_history_available: false,
      stock_is_current: true,
      stock_note: 'Current snapshot',
      zero_months_filled: true,
    },
    model_version: 'products-v2',
    product_id: 42,
    sales_series: units.map((value, index) => buildPoint(index + 1, value, index < 6)),
    snapshot: {
      abc: 'A',
      annual_units: 90,
      avg_price_eur: 10,
      band: 'healthy',
      cover_days: 20,
      eur_value: 1000,
      found: true,
      health: 85,
      lifecycle: 'mature',
      margin_pct: 0.2,
      product_id: 42,
      qty_on_hand: 20,
      return_rate: 0,
      revenue_eur: 900,
      unit_cost_eur: 8,
      xyz: 'X',
    },
    window: {
      end_exclusive: '2026-07-10',
      includes_partial_current_month: true,
      months: 7,
      start: '2026-01-01',
    },
  }
}

function buildPoint(month: number, units: number, isComplete: boolean): ProductSalesSeriesPoint {
  const monthValue = String(month).padStart(2, '0')
  const nextMonthValue = String(month + 1).padStart(2, '0')

  return {
    avg_price_eur: 10,
    is_complete: isComplete,
    month: `2026-${monthValue}`,
    order_count: 1,
    period_end_exclusive: `2026-${nextMonthValue}-01`,
    period_start: `2026-${monthValue}-01`,
    revenue_eur: units * 10,
    units,
  }
}
