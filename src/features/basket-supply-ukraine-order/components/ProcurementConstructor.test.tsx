import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import { getPurchaseCockpitSuppliers } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import {
  createCockpitDraftOrder,
  getPurchaseCockpitCharts,
  getPurchaseCockpitWarehousePlan,
  getProducerPlan,
} from '../api/procurementApi'
import type { ReorderSuggestion } from '../procurementTypes'
import { ProcurementConstructor, ProcurementProofPanel } from './ProcurementConstructor'

const { canMock } = vi.hoisted(() => ({
  canMock: vi.fn<(permissionKey: string) => boolean>(),
}))

vi.mock('../../supply-ukraine-orders/api/supplyUkraineOrdersApi', () => ({
  getPurchaseCockpitSuppliers: vi.fn(),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: canMock, isLoading: false }),
}))

vi.mock('../api/procurementApi', () => ({
  createCockpitDraftOrder: vi.fn(),
  getPurchaseCockpitCharts: vi.fn(),
  getPurchaseCockpitWarehousePlan: vi.fn(),
  getProducerPlan: vi.fn(),
}))

vi.mock('../../assortment/api/assortmentApi', () => ({
  getProductAnalytics: vi.fn().mockResolvedValue({ sales_series: [] }),
}))

describe('ProcurementConstructor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640)
    canMock.mockReturnValue(true)
    vi.mocked(getPurchaseCockpitSuppliers).mockResolvedValue([])
    vi.mocked(getPurchaseCockpitWarehousePlan).mockResolvedValue({
      as_of_date: '2026-07-24',
      source_history_start: '2025-01-01',
      effective_start: '2025-07-24',
      effective_history_days: 365,
      history_complete: true,
      history_not_applicable: ['inventory', 'reservations'],
      budget_eur: 0,
      budget_used_eur: 0,
      deferred_count: 0,
      duplicate_supplier_options_removed: 0,
      is_truncated: false,
      item_count: 2,
      items: [
        suggestion({ producer_id: 501, producer_name: 'Meyle', suggested_qty: 6 }),
        suggestion({ producer_id: 777, producer_name: 'Lemforder', suggested_qty: 4 }),
      ],
      method_used: 'greedy',
      model_version: 'test',
      priced_cost_eur: 60,
      selected_count: 2,
      total_cost_eur: 60,
      total_item_count: 2,
      total_suggested_qty: 10,
      unpriced_item_count: 0,
      value_captured_eur: 0,
    })
    vi.mocked(getProducerPlan).mockRejectedValue(new Error('not used'))
    vi.mocked(getPurchaseCockpitCharts).mockRejectedValue(new Error('not used'))
    vi.mocked(createCockpitDraftOrder).mockResolvedValue({
      ClientAgreementId: 20,
      CurrencyCode: 'EUR',
      CurrencyId: 2,
      Items: [],
      OrderId: 1,
      OrderNumber: '1',
      OrganizationId: 10,
      SupplierId: 501,
      TotalNetAmount: 0,
      TotalQty: 0,
    })
  })

  it('does not mount procurement requests without purchase-cockpit page access', () => {
    canMock.mockReturnValue(false)

    render(
      <MantineProvider theme={theme}>
        <I18nProvider>
          <ProcurementConstructor />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByText('Недостатньо прав для перегляду панелі закупівель')).not.toBeNull()
    expect(getPurchaseCockpitSuppliers).not.toHaveBeenCalled()
    expect(getPurchaseCockpitWarehousePlan).not.toHaveBeenCalled()
  })

  it('does not expose export or draft creation with page-only access', async () => {
    canMock.mockImplementation(
      (permissionKey) => permissionKey === 'orders.purchase_cockpit.page.view',
    )

    render(
      <MantineProvider theme={theme}>
        <I18nProvider>
          <ProcurementConstructor />
        </I18nProvider>
      </MantineProvider>,
    )

    const addAll = await screen.findByRole('button', { name: 'Термінові в кошик · 2' })
    expect(screen.queryByRole('button', { name: 'Експорт в Excel' })).toBeNull()

    fireEvent.click(addAll)

    await waitFor(() => expect(screen.getByText('Кошик замовлень')).not.toBeNull())
    expect(screen.queryByRole('button', { name: 'Створити чернетку' })).toBeNull()
    expect(createCockpitDraftOrder).not.toHaveBeenCalled()
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
    expect(screen.getByRole('button', { name: 'Експорт в Excel' })).not.toBeNull()

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

    expect(screen.getByText('Кошик замовлень')).not.toBeNull()
    expect(screen.getByText('Розподілено за виробниками')).not.toBeNull()
    expect(screen.getByText('Виробників')).not.toBeNull()
    expect(screen.getByText('Загальна сума')).not.toBeNull()
    expect(screen.getByText('65,00')).not.toBeNull()

    const basketRail = screen.getByText('Кошик замовлень').closest('aside')
    expect(basketRail).not.toBeNull()
    const producerNames = within(basketRail as HTMLElement).getAllByText(/Lemforder|Meyle/)
    expect(producerNames.map((node) => node.textContent)).toEqual(['Lemforder', 'Meyle'])

    fireEvent.click(screen.getByRole('button', { name: 'Очистити кошик' }))
    await waitFor(() => {
      expect(screen.queryByText('Кошик замовлень')).toBeNull()
    })
  })

  it('keeps failed demand unknown and recovers through retry', async () => {
    const success = await vi.mocked(getPurchaseCockpitWarehousePlan)({ budgetEur: 0, method: 'greedy' })
    vi.mocked(getPurchaseCockpitWarehousePlan).mockRejectedValueOnce(new Error('upstream failed')).mockResolvedValue(success)
    render(<MantineProvider theme={theme}><I18nProvider><ProcurementConstructor /></I18nProvider></MantineProvider>)

    expect(screen.queryByText('Запас покрито')).toBeNull()
    expect(await screen.findByText('Не вдалося завантажити план закупівлі')).not.toBeNull()
    expect(screen.queryByText('Запас покрито')).toBeNull()
    expect(screen.getByText('Позицій до замовлення').parentElement?.textContent).toContain('—')
    expect(screen.queryAllByLabelText('Замовити')).toHaveLength(0)

    fireEvent.click(await screen.findByRole('button', { name: 'Повторити' }))
    expect(await screen.findByRole('button', { name: 'Термінові в кошик · 2' })).not.toBeNull()
    expect(screen.queryByText('Не вдалося завантажити план закупівлі')).toBeNull()
    expect(screen.getByText('Позицій до замовлення').parentElement?.textContent).toContain('2')
  })

  it('preserves a fractional pack through the basket and draft request', async () => {
    const basePlan = await vi.mocked(getPurchaseCockpitWarehousePlan)({ budgetEur: 0, method: 'greedy' })
    vi.mocked(getPurchaseCockpitWarehousePlan).mockResolvedValue({ ...basePlan,
      items: [suggestion({ suggested_qty: 0.021, raw_qty: 0.02, order_multiple: 0.003,
        unit_cost_eur: 100, line_cost_eur: 2.1 })], item_count: 1, total_item_count: 1,
      total_suggested_qty: 0.021, total_cost_eur: 2.1, priced_cost_eur: 2.1, selected_count: 1,
    })
    render(<MantineProvider theme={theme}><I18nProvider><ProcurementConstructor /></I18nProvider></MantineProvider>)

    fireEvent.click(await screen.findByRole('button', { name: 'Термінові в кошик · 1' }))
    const rail = screen.getByText('Кошик замовлень').closest('aside')!
    expect((within(rail).getByLabelText('Кількість Гальмівний диск') as HTMLInputElement).value).toBe('0.021')
    expect(within(rail).getAllByText('2,10').length).toBeGreaterThan(0)
    fireEvent.click(within(rail).getByRole('button', { name: 'Створити чернетку' }))
    await waitFor(() => expect(createCockpitDraftOrder).toHaveBeenCalledWith(501, [{ productId: 42, qty: 0.021 }]))
  })

  it('shows the fractional quantity and its actual cost in the decision explanation', async () => {
    const row = suggestion({ suggested_qty: 0.021, raw_qty: 0.02, order_multiple: 0.003,
      unit_cost_eur: 100, line_cost_eur: 2.1, order_up_to: 2.021 })
    const { container } = render(<MantineProvider theme={theme}>
      <ProcurementProofPanel row={row} selectedQty={0.021} demand={[]} t={value => value} />
    </MantineProvider>)
    await waitFor(() => expect(container.querySelector('.procure-proof__order-qty')?.textContent).toContain('0,021'))
    expect(container.querySelector('.procure-proof')?.textContent).not.toContain('шт.')
    expect(screen.getByText('2,10')).not.toBeNull()
  })

  it('does not keep an old plan actionable after a failed refresh', async () => {
    render(<MantineProvider theme={theme}><I18nProvider><ProcurementConstructor /></I18nProvider></MantineProvider>)
    await screen.findByRole('button', { name: 'Термінові в кошик · 2' })
    vi.mocked(getPurchaseCockpitWarehousePlan).mockRejectedValue(new Error('upstream failed'))
    fireEvent.click(screen.getByRole('button', { name: 'Оновити' }))

    await screen.findByText('Не вдалося завантажити план закупівлі')
    expect(screen.queryAllByLabelText('Замовити')).toHaveLength(0)
    expect((screen.getByRole('button', { name: 'Термінові в кошик · 0' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText('Запас покрито')).toBeNull()
  })

  it('explains when the current stock does not require replenishment', async () => {
    vi.mocked(getPurchaseCockpitWarehousePlan).mockResolvedValue({
      as_of_date: '2026-07-24',
      source_history_start: '2025-01-01',
      effective_start: '2025-07-24',
      effective_history_days: 365,
      history_complete: true,
      history_not_applicable: ['inventory', 'reservations'],
      budget_eur: 0,
      budget_used_eur: 0,
      deferred_count: 0,
      duplicate_supplier_options_removed: 0,
      is_truncated: false,
      item_count: 0,
      items: [],
      method_used: 'greedy',
      model_version: 'test',
      priced_cost_eur: 0,
      selected_count: 0,
      total_cost_eur: 0,
      total_item_count: 0,
      total_suggested_qty: 0,
      unpriced_item_count: 0,
      value_captured_eur: 0,
    })

    render(
      <MantineProvider theme={theme}>
        <I18nProvider>
          <ProcurementConstructor />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(await screen.findByText('Позицій до замовлення немає')).not.toBeNull()
    expect(screen.getByText('Запас покрито')).not.toBeNull()
  })

  it('marks unpriced lines instead of presenting them as zero-cost purchases', async () => {
    const basePlan = await vi.mocked(getPurchaseCockpitWarehousePlan)({ budgetEur: 0, method: 'greedy' })

    vi.mocked(getPurchaseCockpitWarehousePlan).mockResolvedValue({
      ...basePlan,
      item_count: 1,
      items: [suggestion({ line_cost_eur: null, unit_cost_eur: null })],
      priced_cost_eur: 0,
      selected_count: 1,
      total_cost_eur: null,
      total_item_count: 1,
      total_suggested_qty: 6,
      unpriced_item_count: 1,
    })

    render(
      <MantineProvider theme={theme}>
        <I18nProvider>
          <ProcurementConstructor />
        </I18nProvider>
      </MantineProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Термінові в кошик · 1' }))

    expect(await screen.findByText('Без ціни')).not.toBeNull()
    expect(screen.getAllByText('Сума з ціною')).toHaveLength(2)
    expect(screen.getByText('1 без ціни')).not.toBeNull()
  })
})

function suggestion(overrides: Partial<ReorderSuggestion> = {}): ReorderSuggestion {
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
    image_url: null,
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
    seasonal_factor: overrides.seasonal_factor ?? null,
  }
}
