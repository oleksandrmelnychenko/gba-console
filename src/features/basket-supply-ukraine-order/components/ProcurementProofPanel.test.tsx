import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { getProductAnalytics } from '../../assortment/api/assortmentApi'
import type { ReorderSuggestion } from '../procurementTypes'
import { ProcurementProofPanel } from './ProcurementConstructor'

vi.mock('../../assortment/api/assortmentApi', () => ({
  getProductAnalytics: vi.fn(),
}))

const t = (key: string) => key

describe('ProcurementProofPanel', () => {
  it('presents the recommendation as a user-facing decision with evidence', async () => {
    vi.mocked(getProductAnalytics).mockResolvedValueOnce({
      sales_series: [
        {
          avg_price_eur: 66.67,
          is_complete: true,
          month: '2026-06',
          order_count: 4,
          period_end_exclusive: '2026-07-01',
          period_start: '2026-06-01',
          revenue_eur: 1200,
          units: 18,
        },
      ],
    } as Awaited<ReturnType<typeof getProductAnalytics>>)

    render(
      <MantineProvider theme={theme}>
        <ProcurementProofPanel
          row={suggestion()}
          selectedQty={36}
          t={t}
        />
      </MantineProvider>,
    )

    expect(screen.getByText('Рекомендація закупівлі')).not.toBeNull()
    expect(screen.getByText('Змінено вручну')).not.toBeNull()
    expect(screen.getByText('Як отримано кількість')).not.toBeNull()
    expect(screen.getByText('Коли виникне дефіцит')).not.toBeNull()
    expect(screen.getByText('Параметри прогнозу')).not.toBeNull()
    expect(await screen.findByText('черв. 2026 р.')).not.toBeNull()
    expect(screen.getAllByText('18').length).toBeGreaterThan(1)
  })
})

function suggestion(): ReorderSuggestion {
  return {
    abc: 'A',
    applied_service_level: 0.95,
    cheaper_alt: { cost_eur: 4.1, producer_id: 7 },
    days_of_cover: 4,
    forecast: {
      product_id: 100,
      forecast_units: 60,
      horizon_days: 30,
      mean_daily: 0,
      method: 'croston',
      std_daily: 0.4,
    },
    image_url: null,
    inventory: {
      product_id: 100,
      available: 8,
      on_hand: 10,
      on_order: 0,
      position: 8,
      reserved: 2,
    },
    lead_demand: 12,
    learned_factor: null,
    line_cost_eur: 135,
    moq: null,
    oe_number: '8K0615301M',
    order_multiple: null,
    order_up_to: 38,
    producer_id: 42,
    producer_name: 'Acme',
    product_id: 100,
    product_name: 'Гальмівний диск передній',
    quadrant: 'AX',
    raw_qty: 30,
    reason: '',
    reorder_point: 18,
    safety_stock: 6,
    seasonal_factor: null,
    suggested_qty: 30,
    unit_cost_eur: 4.5,
    unit_margin_eur: 3,
    unit_sale_eur: 7.5,
    urgency: 'critical',
    value_density: null,
    vendor_code: 'BR-2048',
    within_budget: null,
    xyz: 'X',
  }
}
