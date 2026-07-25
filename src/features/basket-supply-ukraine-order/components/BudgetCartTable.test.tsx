import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import type { ReorderSuggestion } from '../procurementTypes'
import { BudgetCartTable } from './BudgetCartTable'

describe('BudgetCartTable', () => {
  it('shows a useful product identity with its image and supplier name', () => {
    const { container } = render(
      <MantineProvider theme={theme}>
        <I18nProvider>
          <BudgetCartTable
            items={[suggestion()]}
            producerNameById={new Map([[501, 'Meyle']])}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByText('Гальмівний диск')).not.toBeNull()
    expect(screen.getByText('BR-2048')).not.toBeNull()
    expect(screen.getByText('Meyle')).not.toBeNull()
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.example.com/brake-disc.jpg',
    )
    expect(screen.queryByText('#42')).toBeNull()
  })
})

function suggestion(): ReorderSuggestion {
  return {
    abc: 'A',
    applied_service_level: 0.95,
    cheaper_alt: null,
    days_of_cover: 4,
    forecast: {
      product_id: 42,
      forecast_units: 60,
      horizon_days: 30,
      mean_daily: 2,
      method: 'croston',
      std_daily: 0.4,
    },
    image_url: 'https://cdn.example.com/brake-disc.jpg',
    inventory: {
      product_id: 42,
      available: 2,
      on_hand: 2,
      on_order: 0,
      position: 2,
      reserved: 0,
    },
    lead_demand: 12,
    learned_factor: null,
    line_cost_eur: 30,
    moq: null,
    oe_number: 'OE-100',
    order_multiple: null,
    order_up_to: 38,
    producer_id: 501,
    producer_name: 'Meyle',
    product_id: 42,
    product_name: 'Гальмівний диск',
    quadrant: 'AX',
    raw_qty: 6,
    reason: 'Залишок нижче точки замовлення',
    reorder_point: 18,
    safety_stock: 6,
    seasonal_factor: null,
    suggested_qty: 6,
    unit_cost_eur: 5,
    unit_margin_eur: 3,
    unit_sale_eur: 8,
    urgency: 'critical',
    value_density: 0.75,
    vendor_code: 'BR-2048',
    within_budget: true,
    xyz: 'X',
  }
}
