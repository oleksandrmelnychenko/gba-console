import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import { getSupplyOrderSuppliers } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import {
  createCockpitDraftOrder,
  getBudgetCartPlan,
  getProcurementCharts,
  getProducerPlan,
} from '../api/procurementApi'
import type { ReorderSuggestion } from '../procurementTypes'
import { ProcurementConstructor } from './ProcurementConstructor'

vi.mock('../../supply-ukraine-orders/api/supplyUkraineOrdersApi', () => ({
  getSupplyOrderSuppliers: vi.fn(),
}))

vi.mock('../api/procurementApi', () => ({
  createCockpitDraftOrder: vi.fn(),
  getBudgetCartPlan: vi.fn(),
  getProcurementCharts: vi.fn(),
  getProducerPlan: vi.fn(),
}))

describe('ProcurementConstructor', () => {
  beforeEach(() => {
    vi.mocked(getSupplyOrderSuppliers).mockResolvedValue([])
    vi.mocked(getBudgetCartPlan).mockResolvedValue({
      as_of_date: '2026-07-24',
      budget_eur: 0,
      budget_used_eur: 0,
      deferred_count: 0,
      item_count: 2,
      items: [
        suggestion({ producer_id: 501, producer_name: 'Meyle', suggested_qty: 6 }),
        suggestion({ producer_id: 777, producer_name: 'Lemforder', suggested_qty: 4 }),
      ],
      method_used: 'greedy',
      model_version: 'test',
      selected_count: 2,
      value_captured_eur: 0,
    })
    vi.mocked(getProducerPlan).mockRejectedValue(new Error('not used'))
    vi.mocked(getProcurementCharts).mockRejectedValue(new Error('not used'))
    vi.mocked(createCockpitDraftOrder).mockResolvedValue({})
  })

  it('edits and bulk-adds the same product from different producers independently', async () => {
    render(
      <MantineProvider theme={theme}>
        <I18nProvider>
          <ProcurementConstructor />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(await screen.findByRole('button', { name: 'Термінові в кошик · 2' })).not.toBeNull()

    const quantityInputs = screen.getAllByLabelText('Замовити') as HTMLInputElement[]
    expect(quantityInputs).toHaveLength(2)

    fireEvent.change(quantityInputs[0], { target: { value: '9' } })

    await waitFor(() => {
      const updatedInputs = screen.getAllByLabelText('Замовити') as HTMLInputElement[]
      expect(updatedInputs[0].value).toBe('9')
      expect(updatedInputs[1].value).toBe('4')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Термінові в кошик · 2' }))

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Створити чернетку' })).toHaveLength(2)
      expect(
        (screen.getByRole('button', {
          name: 'Термінові в кошик · 0',
        }) as HTMLButtonElement).disabled,
      ).toBe(true)
    })
  })
})

function suggestion(overrides: Partial<ReorderSuggestion> = {}): ReorderSuggestion {
  return {
    abc: 'A',
    applied_service_level: 0.95,
    cheaper_alt: null,
    days_of_cover: 4,
    forecast: {
      forecast_units: 60,
      horizon_days: 30,
      mean_daily: 2,
      method: 'croston',
      std_daily: 0.4,
    },
    image_url: null,
    inventory: {
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
    oe_number: null,
    order_multiple: null,
    order_up_to: 38,
    producer_id: 501,
    producer_name: 'Meyle',
    product_id: 42,
    product_name: 'Гальмівний диск',
    quadrant: 'AX',
    raw_qty: 6,
    reason: '',
    reorder_point: 18,
    safety_stock: 6,
    suggested_qty: 6,
    unit_cost_eur: 5,
    unit_margin_eur: 3,
    unit_sale_eur: 8,
    urgency: 'critical',
    value_density: null,
    vendor_code: 'BR-2048',
    within_budget: null,
    xyz: 'X',
    ...overrides,
  }
}
