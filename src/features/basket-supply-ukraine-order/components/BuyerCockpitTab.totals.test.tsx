import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getPurchaseCockpitSuppliers } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import { getProducerPlan, getProducerProfile, recordFeedback } from '../api/procurementApi'
import { fixtureCostContext, fixtureLineCostFields } from '../procurementCostTestFixtures'
import type { ReorderSuggestion } from '../procurementTypes'
import { BuyerCockpitTab } from './BuyerCockpitTab'

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, isLoading: false }),
}))

vi.mock('../../supply-ukraine-orders/api/supplyUkraineOrdersApi', () => ({
  getPurchaseCockpitSuppliers: vi.fn(),
}))

vi.mock('../api/procurementApi', () => ({
  createCockpitDraftOrder: vi.fn(),
  getProducerPlan: vi.fn(),
  getProducerProfile: vi.fn(),
  recordFeedback: vi.fn(),
  upsertProducerProfile: vi.fn(),
  upsertProductTerms: vi.fn(),
}))

function suggestion(overrides: Partial<ReorderSuggestion>): ReorderSuggestion {
  return {
    ...fixtureLineCostFields(overrides),
    abc: 'A',
    applied_service_level: 0.95,
    cheaper_alt: null,
    days_of_cover: 4,
    forecast: { product_id: 42, forecast_units: 60, horizon_days: 30, mean_daily: 2, method: 'croston', std_daily: 0.4 },
    image_url: null,
    inventory: { product_id: 42, available: 2, on_hand: 2, on_order: 0, position: 2, reserved: 0 },
    lead_demand: 12,
    learned_factor: null,
    line_cost_eur: 30,
    moq: null,
    oe_number: null,
    order_multiple: null,
    order_up_to: 38,
    producer_id: 42,
    producer_name: 'Acme',
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
    unit_margin_eur: null,
    unit_sale_eur: 8,
    urgency: 'critical',
    value_density: null,
    vendor_code: 'BR-2048',
    within_budget: null,
    xyz: 'X',
    ...overrides,
  }
}

function renderCockpit(items: ReorderSuggestion[], planExtra: Record<string, unknown> = {}) {
  vi.mocked(getPurchaseCockpitSuppliers).mockResolvedValue([{ FullName: 'Acme', Id: 42 }])
  vi.mocked(getProducerPlan).mockResolvedValue({
    as_of_date: '2026-06-15',
    source_history_start: '2025-01-01',
    effective_start: '2025-06-15',
    effective_history_days: 365,
    history_complete: true,
    history_not_applicable: [],
    ...fixtureCostContext(),
    item_count: items.length,
    items,
    lead_time_days: 14,
    lead_time_std_days: 2,
    lead_time_source: 'default',
    model_version: 'test',
    producer_id: 42,
    producer_name: 'Acme',
    ...planExtra,
  } as never)
  vi.mocked(getProducerProfile).mockResolvedValue({
    lead_time_override_days: null, producer_id: 42, service_level_target: null,
  } as never)

  return render(
    <MemoryRouter initialEntries={['/?producerId=42']}>
      <MantineProvider>
        <I18nProvider>
          <BuyerCockpitTab />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

const text = () => (document.body.textContent ?? '').replace(/\u00a0/g, ' ')

describe('BuyerCockpitTab draft totals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1600)
  })

  it('shows one total for the header, the footer and the confirmation and names the unpriced lines', async () => {
    renderCockpit([
      suggestion({ product_id: 42, product_name: 'Гальмівний диск', unit_cost_eur: 5, line_cost_eur: 30 }),
      suggestion({ product_id: 43, product_name: 'Без ціни товар', unit_cost_eur: null, line_cost_eur: null }),
    ])

    await screen.findByText('#42')
    expect(screen.getByText('Чернетка замовлення, EUR без ПДВ').parentElement?.textContent?.replace(/\u00a0/g, ' ')).toContain('30,00')
    expect(screen.getAllByText('1 рядок без ціни не враховано')).toHaveLength(1)
    expect(text()).toContain('Чернетка: 2 позицій · €30,00 · 1 рядок без ціни не враховано')

    fireEvent.click(screen.getByRole('button', { name: 'Створити замовлення постачальнику' }))
    await screen.findByText('Створити чернетку замовлення?')
    expect(text()).toContain('2 позицій · €30,00')
    expect(screen.getAllByText('1 рядок без ціни не враховано')).toHaveLength(2)
  })

  it('says how the lead time was obtained and prints the unit next to the quantity', async () => {
    renderCockpit(
      [suggestion({ product_id: 42, unit_cost_eur: 5, line_cost_eur: 30, measure_unit: 'шт' })],
      { lead_time_basis: 'measured', lead_time_sample_count: 14 },
    )

    await screen.findByText('#42')
    expect(screen.getByTestId('lead-time-basis').textContent).toBe('виміряний за 14 поставками')
    expect(text()).toMatch(/\d шт/)
  })

  it('keeps the old source badge when the service sends no basis', async () => {
    renderCockpit([suggestion({ product_id: 42, unit_cost_eur: 5, line_cost_eur: 30 })])

    await screen.findByText('#42')
    expect(screen.queryByTestId('lead-time-basis')).toBeNull()
    expect(screen.getByText('за замовч.')).not.toBeNull()
  })

  it('drops a dismissed line from every total, not only from the confirmation', async () => {
    vi.mocked(recordFeedback).mockResolvedValue(undefined as never)
    renderCockpit([
      suggestion({ product_id: 42, product_name: 'Гальмівний диск', unit_cost_eur: 5, line_cost_eur: 30 }),
      suggestion({ product_id: 44, product_name: 'Дорогий товар', unit_cost_eur: 20, line_cost_eur: 120 }),
    ])

    await screen.findByText('#44')
    expect(text()).toContain('Чернетка: 2 позицій · €150,00')
    expect(screen.queryByText(/без ціни не враховано/)).toBeNull()

    const row = screen.getByText('#44').closest('tr')!
    fireEvent.click(row.querySelector('[aria-label="Відхилити"], [title="Відхилити"]') as HTMLElement)

    await waitFor(() => expect(text()).toContain('Чернетка: 1 позицій · €30,00'))
    expect(screen.getByText('Чернетка замовлення, EUR без ПДВ').parentElement?.textContent?.replace(/\u00a0/g, ' ')).toContain('30,00')
  })
})
