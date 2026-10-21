import { fixtureCostContext, fixtureNoBudget, fixtureLineCostFields } from '../procurementCostTestFixtures'
import { Profiler } from 'react'
import type { DataTableProps } from '../../../shared/ui/data-table/types'
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

const { canMock, planRenderMock, tableRenderMock } = vi.hoisted(() => ({
  planRenderMock: vi.fn(),
  tableRenderMock: vi.fn(),
  canMock: vi.fn<(permissionKey: string) => boolean>(),
}))

vi.mock('../../../shared/ui/data-table/DataTable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/ui/data-table/DataTable')>()
  return { ...actual, DataTable: (props: DataTableProps<unknown>) => {
    tableRenderMock()
    return (
    <Profiler id="plan-grid" onRender={planRenderMock}>
      <actual.DataTable {...props} />
    </Profiler>
    )
  } }
})

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
    window.history.replaceState({}, '', '/')
    localStorage.removeItem('gba.procurement.sessions.v1')
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640)
    canMock.mockReturnValue(true)
    vi.mocked(getPurchaseCockpitSuppliers).mockResolvedValue([])
    vi.mocked(getPurchaseCockpitWarehousePlan).mockResolvedValue({
      as_of_date: '2026-07-24',
      source_history_start: '2025-01-01',
      effective_start: '2025-07-24',
      effective_history_days: 365,
      history_complete: true,
      history_not_applicable: ['inventory', 'reservations', 'purchase_costs'],
      ...fixtureCostContext(),
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
      ...fixtureNoBudget,
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

  it('clears a deep-linked product filter when restoring another session and skips unused chart requests', async () => {
    window.history.replaceState({}, '', '/?productId=42&producerId=501')
    const plan = await vi.mocked(getPurchaseCockpitWarehousePlan)({ budgetEur: 0, method: 'greedy' })
    vi.mocked(getProducerPlan).mockResolvedValue({ ...plan, history_scope: 'demand', producer_id: 501, producer_name: 'Meyle', lead_time_days: 7, lead_time_std_days: 0, lead_time_source: 'test' })
    vi.mocked(getPurchaseCockpitWarehousePlan).mockResolvedValue({ ...plan, items: [suggestion({ product_id: 999, product_name: 'Restored item', producer_id: 777 })] })
    localStorage.setItem('gba.procurement.sessions.v1', JSON.stringify([{ id: 'restore-other', name: 'Other plan',
      savedAt: '2026-09-08T00:00:00Z', lens: 'warehouse', producerId: null, draftQty: {}, basket: [] }]))
    render(<MantineProvider theme={theme}><I18nProvider><ProcurementConstructor /></I18nProvider></MantineProvider>)
    await waitFor(() => expect(getProducerPlan).toHaveBeenCalled())
    expect((screen.getByPlaceholderText('Товар, код або виробник') as HTMLInputElement).value).toBe('42')
    fireEvent.click(screen.getByRole('button', { name: 'Сесії' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Other plan/ }))
    expect(await screen.findByText('Restored item')).not.toBeNull()
    expect((screen.getByPlaceholderText('Товар, код або виробник') as HTMLInputElement).value).toBe('')
    expect(getPurchaseCockpitCharts).not.toHaveBeenCalled()
  })

  it('restores legacy basket quantities with unknown cost and sends only exact IDs/quantity to the mocked draft endpoint', async () => {
    const legacy = { ...suggestion({ producer_id: 501, producer_name: 'Meyle' }) } as Record<string, unknown>
    delete legacy.cost_provenance
    localStorage.setItem('gba.procurement.sessions.v1', JSON.stringify([{ id: 'legacy-cost-fixture', name: 'Legacy cost fixture',
      savedAt: '2026-09-08T00:00:00Z', lens: 'warehouse', producerId: null, draftQty: {}, basket: [{ suggestion: legacy, qty: .021 }] }]))
    render(<MantineProvider theme={theme}><I18nProvider><ProcurementConstructor /></I18nProvider></MantineProvider>)
    await screen.findByRole('button', { name: 'Термінові в кошик · 2' })
    fireEvent.click(screen.getByRole('button', { name: 'Сесії' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Legacy cost fixture/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Кошик · 1' }))
    expect(await screen.findByText('Джерело оцінки не підтверджено для поточного плану. Кількість збережено без переоцінки.')).not.toBeNull()
    expect(screen.getAllByText('1 без ціни').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Створити чернетку' }))
    await waitFor(() => expect(createCockpitDraftOrder).toHaveBeenCalledWith(501, [{ productId: 42, qty: .021 }]))
    localStorage.removeItem('gba.procurement.sessions.v1')
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
    fireEvent.click(screen.getByRole('button', { name: 'Кошик · 2' }))

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
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((screen.getByRole('button', { name: 'Термінові в кошик · 0' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Кошик · 2' }))

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Створити чернетку' })).toHaveLength(2)
    })

    expect(screen.getByText('Кошик замовлень')).not.toBeNull()
    expect(screen.getByText('Виробників')).not.toBeNull()
    expect(screen.getByText('Сума оцінок')).not.toBeNull()
    expect(screen.getByText('65,00')).not.toBeNull()

    const basketRail = screen.getByRole('dialog', { name: 'Кошик замовлень' })
    expect(basketRail).not.toBeNull()
    const producerNames = within(basketRail as HTMLElement).getAllByText(/Lemforder|Meyle/)
    expect(producerNames.map((node) => node.textContent)).toEqual(['Lemforder', 'Meyle'])

    const collapseMeyle = screen.getByRole('button', { name: 'Згорнути Meyle' })
    expect(collapseMeyle.querySelector('.app-table-chip.is-document')?.textContent).toBe('Meyle')
    fireEvent.click(collapseMeyle)
    expect(screen.getByRole('button', { name: 'Розгорнути Meyle' }).getAttribute('aria-expanded')).toBe('false')
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Створити чернетку' })).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Згорнути Lemforder' }).getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Розгорнути Meyle' }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Створити чернетку' })).toHaveLength(2))
    expect((within(basketRail).getAllByLabelText('Кількість Гальмівний диск') as HTMLInputElement[]).map(input => input.value)).toEqual(['4', '9'])

    fireEvent.click(screen.getByRole('button', { name: 'Очистити кошик' }))
    await waitFor(() => {
      expect(screen.getByText('Кошик порожній')).not.toBeNull()
    })
  })

  it('opens the basket from a row plus and re-expands its previously collapsed producer', async () => {
    render(<MantineProvider theme={theme}><I18nProvider><ProcurementConstructor /></I18nProvider></MantineProvider>)
    const addButtons = await screen.findAllByRole('button', { name: 'Додати в кошик' })
    fireEvent.click(addButtons[0])

    expect(await screen.findByRole('dialog', { name: 'Кошик замовлень' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Згорнути Meyle' }).getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Згорнути Meyle' }))
    fireEvent.click(screen.getByRole('button', { name: 'Закрити кошик' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'У кошику' }))
    expect(await screen.findByRole('dialog', { name: 'Кошик замовлень' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Згорнути Meyle' }).getAttribute('aria-expanded')).toBe('true')
    expect((screen.getByLabelText('Кількість Гальмівний диск') as HTMLInputElement).value).toBe('6')
    expect(createCockpitDraftOrder).not.toHaveBeenCalled()
  })

  it('does not re-render the plan grid for sheet controls or basket quantity edits', async () => {
    render(<MantineProvider theme={theme}><I18nProvider><ProcurementConstructor /></I18nProvider></MantineProvider>)
    fireEvent.click(await screen.findByRole('button', { name: 'Термінові в кошик · 2' }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'У кошику' })).toHaveLength(2))
    planRenderMock.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Кошик · 2' }))
    fireEvent.change(screen.getAllByLabelText('Кількість Гальмівний диск')[0], { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Згорнути Meyle' }))
    fireEvent.click(screen.getByRole('button', { name: 'Закрити кошик' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    expect(planRenderMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Кошик · 2' }))
    expect((screen.getAllByLabelText('Кількість Гальмівний диск')[0] as HTMLInputElement).value).toBe('12')
  })

  it('keeps analytics controls local and adds the edited fractional quantity to the expanded producer basket', async () => {
    render(<MantineProvider theme={theme}><I18nProvider><ProcurementConstructor /></I18nProvider></MantineProvider>)
    await screen.findByRole('button', { name: 'Термінові в кошик · 2' })
    fireEvent.click(screen.getAllByRole('button', { name: 'Розгорнути рядок' })[0])
    const panel = await screen.findByRole('article', { name: 'Аналітика товару' })
    await within(panel).findByText('За цей період даних немає')
    tableRenderMock.mockClear()

    fireEvent.click(within(panel).getByRole('button', { name: 'Виручка' }))
    fireEvent.click(within(panel).getByRole('button', { name: 'Розрахунок' }))
    expect(within(panel).getByText('Страховий запас')).not.toBeNull()
    expect(tableRenderMock).not.toHaveBeenCalled()

    fireEvent.change(within(panel).getByLabelText('Кількість до кошика'), { target: { value: '0.021' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'У кошик' }))
    const basket = await screen.findByRole('dialog', { name: 'Кошик замовлень' })
    expect(within(basket).getByRole('button', { name: 'Згорнути Meyle' }).getAttribute('aria-expanded')).toBe('true')
    expect((within(basket).getByLabelText('Кількість Гальмівний диск') as HTMLInputElement).value).toBe('0.021')
    expect(createCockpitDraftOrder).not.toHaveBeenCalled()
  })

  it('pages the plan while keeping search, bulk actions and basket state across all rows', async () => {
    const basePlan = await vi.mocked(getPurchaseCockpitWarehousePlan)({ budgetEur: 0, method: 'greedy' })
    const items = Array.from({ length: 61 }, (_, index) => suggestion({
      product_id: index + 1,
      product_name: `Тестова позиція ${index + 1}`,
      vendor_code: `PAGE-${index + 1}`,
    }))
    vi.mocked(getPurchaseCockpitWarehousePlan).mockResolvedValue({ ...basePlan, items, item_count: 61 })
    render(<MantineProvider theme={theme}><I18nProvider><ProcurementConstructor /></I18nProvider></MantineProvider>)

    await screen.findByRole('button', { name: 'Термінові в кошик · 61' })
    expect(screen.getAllByLabelText('Замовити')).toHaveLength(50)
    expect(screen.queryByText('Тестова позиція 61')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
    expect(screen.getAllByLabelText('Замовити')).toHaveLength(11)
    expect(screen.getByText('Тестова позиція 61')).not.toBeNull()
    fireEvent.change(screen.getAllByLabelText('Замовити')[0], { target: { value: '9' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Додати в кошик' })[0])
    expect((screen.getByLabelText('Кількість Тестова позиція 51') as HTMLInputElement).value).toBe('9')
    fireEvent.click(screen.getByRole('button', { name: 'Закрити кошик' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('button', { name: 'Кошик · 1' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Термінові в кошик · 60' })).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Попередня сторінка' }))
    fireEvent.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
    expect((screen.getAllByLabelText('Замовити')[0] as HTMLInputElement).value).toBe('9')
    fireEvent.change(screen.getByLabelText('Пошук у плані'), { target: { value: 'PAGE-61' } })
    await waitFor(() => expect(screen.getAllByLabelText('Замовити')).toHaveLength(1))
    expect(screen.getByText('Тестова позиція 61')).not.toBeNull()
    expect((screen.getByLabelText('Номер сторінки') as HTMLInputElement).value).toBe('1')
    expect(screen.getByRole('button', { name: 'Кошик · 1' })).not.toBeNull()
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
    fireEvent.click(screen.getByRole('button', { name: 'Кошик · 1' }))
    const rail = screen.getByRole('dialog', { name: 'Кошик замовлень' })!
    expect((within(rail).getByLabelText('Кількість Гальмівний диск') as HTMLInputElement).value).toBe('0.021')
    expect(within(rail).getAllByText('2,10').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Закрити кошик' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Кошик · 1' }))
    const reopenedSheet = screen.getByRole('dialog', { name: 'Кошик замовлень' })
    expect((within(reopenedSheet).getByLabelText('Кількість Гальмівний диск') as HTMLInputElement).value).toBe('0.021')
    fireEvent.click(within(reopenedSheet).getByRole('button', { name: 'Створити чернетку' }))
    await waitFor(() => expect(createCockpitDraftOrder).toHaveBeenCalledWith(501, [{ productId: 42, qty: 0.021 }]))
  })

  it('shows the fractional quantity and its actual cost in the decision explanation', async () => {
    const row = suggestion({ suggested_qty: 0.021, raw_qty: 0.02, order_multiple: 0.003,
      unit_cost_eur: 100, line_cost_eur: 2.1, order_up_to: 2.021 })
    const { container } = render(<MantineProvider theme={theme}>
      <ProcurementProofPanel row={row} selectedQty={0.021} t={value => value} />
    </MantineProvider>)
    await waitFor(() => expect(screen.getByText('0,021')).not.toBeNull())
    expect(container.querySelector('.procurement-item-analytics')?.textContent).not.toContain('шт.')
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
      history_not_applicable: ['inventory', 'reservations', 'purchase_costs'],
      ...fixtureCostContext(),
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
      ...fixtureNoBudget,
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
    fireEvent.click(screen.getByRole('button', { name: 'Кошик · 1' }))

    expect(await screen.findByText('Без ціни')).not.toBeNull()
    expect(screen.getAllByText('Відомі оцінки')).toHaveLength(2)
    expect(screen.getByText('1 без ціни')).not.toBeNull()
  })
})

function suggestion(overrides: Partial<ReorderSuggestion> = {}): ReorderSuggestion {
  return {
    ...fixtureLineCostFields(overrides),
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
    unit_margin_eur: null,
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
