import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { ProductAnalytics, ProductSalesSeriesPoint } from '../types'
import { ProductSalesAnalytics } from './ProductSalesAnalytics'

describe('ProductSalesAnalytics', () => {
  it('switches one chart and recomputes real totals for the selected calendar period', () => {
    renderAnalytics(buildAnalytics())
    const metrics = screen.getByRole('group', { name: 'Показник продажів' })
    expect(within(metrics).getByRole('button', { name: 'Продано 95' })).toBeTruthy()
    expect(screen.getByText('Тренд 3 міс.: +100%')).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Графік: Продано' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '3 міс.' }))
    expect(within(metrics).getByRole('button', { name: 'Продано 45' })).toBeTruthy()
    fireEvent.click(within(metrics).getByRole('button', { name: /До повернень/ }))
    expect(screen.getByRole('group', { name: 'Графік: До повернень, EUR' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Графік: Продано' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Дані' }))
    expect(screen.getAllByRole('row')).toHaveLength(4)
    expect(screen.queryByRole('group', { name: 'Графік: До повернень, EUR' })).toBeNull()
  })

  it('shows signed net amounts and rounds selected exact monthly basis once', () => {
    const analytics = buildAnalytics()
    analytics.sales_series = analytics.sales_series.map((point, index) => ({ ...point,
      revenue_eur: index === 5 || index === 6 ? 1.01 : 0,
      net_revenue_eur: index === 6 ? -1 : index === 5 ? 1.01 : 0,
      financial_basis: { revenue_eur: index === 5 || index === 6 ? '1.005' : '0', known_returned_value_eur: index === 6 ? '2.005' : '0', unresolved_amount_count: 0 },
    }))
    renderAnalytics(analytics)
    fireEvent.click(screen.getByRole('button', { name: '3 міс.' }))
    expect(screen.getByRole('button', { name: 'До повернень 2,01 EUR' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Мінус повернення 0,01 EUR' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Мінус повернення 0,01 EUR' }))
    expect(screen.getByRole('group', { name: 'Графік: Мінус повернення, EUR' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Дані' }))
    expect(screen.getByRole('table').textContent).toContain('-1,00')
  })

  it('preserves partial actuals but excludes the partial month from the comparison', () => {
    const analytics = buildAnalytics()
    analytics.sales_series[6] = buildPoint(7, 1000, false)
    renderAnalytics(analytics)
    expect(screen.getByRole('button', { name: /Продано 1\s090/ })).toBeTruthy()
    expect(screen.getByText('Тренд 3 міс.: +100%')).toBeTruthy()
    expect(screen.getByText('Неповний місяць').closest('[title]')?.getAttribute('title')).toContain('09.07.2026')
  })

  it('uses a quantity-weighted average and retains cents', () => {
    const analytics = buildAnalytics()
    analytics.sales_series = analytics.sales_series.map(point => ({ ...point, avg_price_eur: 0.25, revenue_eur: point.units * 0.25 }))
    renderAnalytics(analytics)
    expect(screen.getByRole('button', { name: 'Середня ціна 0,25 EUR' })).toBeTruthy()
  })

  it('keeps missing calendar months as unknown and does not compare across gaps', () => {
    const analytics = buildAnalytics()
    analytics.sales_series.splice(2, 1)
    renderAnalytics(analytics)
    expect(screen.getByRole('button', { name: 'Продано —' })).toBeTruthy()
    expect(screen.getByText('Недостатньо історії для тренду')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Дані' }))
    const march = screen.getAllByRole('row').find(row => row.textContent?.includes('бер.'))!
    expect(march.textContent).toContain('—')
    expect(within(march).getAllByRole('cell').slice(1).map(cell => cell.textContent)).toEqual(['—', '—', '—', '—', '—'])
  })

  it('does not turn missing fields into zero or NaN', () => {
    const analytics = buildAnalytics()
    analytics.sales_series[6] = { ...analytics.sales_series[6], revenue_eur: null, avg_price_eur: undefined } as unknown as ProductSalesSeriesPoint
    renderAnalytics(analytics)
    expect(screen.getByRole('button', { name: 'До повернень — EUR' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Продано 95' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Дані' }))
    expect(screen.getByRole('table').textContent).not.toContain('NaN')
  })

  it('distinguishes a real zero series, resumed sales, empty data, and API errors', () => {
    const analytics = buildAnalytics()
    analytics.sales_series = analytics.sales_series.map(point => ({ ...point, units: 0, revenue_eur: 0, order_count: 0, avg_price_eur: null }))
    const view = renderAnalytics(analytics)
    expect(screen.getByRole('button', { name: 'Продано 0' })).toBeTruthy()
    expect(screen.getByText('Без продажів')).toBeTruthy()
    view.unmount()
    analytics.sales_series = [0, 0, 0, 5, 5, 5, 1].map((value, index) => buildPoint(index + 1, value, index < 6))
    const resumed = renderAnalytics(analytics)
    expect(screen.getByText('Продажі відновилися')).toBeTruthy()
    resumed.unmount()
    const empty = renderAnalytics(null)
    expect(screen.getByText('За вибраний період немає даних продажів.')).toBeTruthy()
    empty.unmount()
    renderAnalytics(null, 'Analytics 503')
    expect(screen.getByRole('alert').textContent).toContain('Analytics 503')
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
    source_history_start: '2025-01-01',
    requested_start: '2026-01-01',
    effective_start: '2026-01-01',
    history_complete: true,
    history_fingerprint: 'products-history-20250101',
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
      zero_fill_begins_at: '2026-01-01',
      source_history_start: '2025-01-01',
      requested_start: '2026-01-01',
      effective_start: '2026-01-01',
      history_complete: true,
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
      source_history_start: '2025-01-01',
      requested_start: '2026-01-01',
      effective_start: '2026-01-01',
      effective_days: 190,
      history_complete: true,
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
