import { fixtureCostContext } from '../procurementCostTestFixtures'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { theme } from '../../../shared/theme/theme'
import { getSupplyDashboardSuppliers } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import { getSupplyDashboardCharts } from '../api/procurementApi'
import type { ProcurementCharts } from '../procurementTypes'
import { ProcureDashboardTab } from './ProcureDashboardTab'

const { canMock } = vi.hoisted(() => ({
  canMock: vi.fn<(permissionKey: string) => boolean>(),
}))

vi.mock('../api/procurementApi', () => ({
  getSupplyDashboardCharts: vi.fn(),
}))

vi.mock('../../supply-ukraine-orders/api/supplyUkraineOrdersApi', () => ({
  getSupplyDashboardSuppliers: vi.fn(),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: canMock, isLoading: false }),
}))

const charts: ProcurementCharts = {
  as_of_date: '2026-07-24',
  source_history_start: '2025-01-01',
  effective_start: '2025-07-24',
  effective_history_days: 365,
  history_complete: true,
  history_not_applicable: ['inventory', 'reservations', 'purchase_costs'],
      ...fixtureCostContext(),
  model_version: 'test',
  days_of_cover_hist: [
    { bucket: '0–7', count: 7 },
    { bucket: '8–30', count: 18 },
  ],
  demand_series: [
    {
      points: [
        { is_forecast: false, period: '2026-06', units: 5 },
        { is_forecast: true, period: '2026-07', units: 8 },
      ],
      product_id: 101,
    },
  ],
  producer_id: null,
  top_items: [
    {
      image_url: 'https://cdn.example.test/brake-disc.png',
      on_hand: 1,
      producer_id: 42,
      producer_name: 'Meyle',
      product_id: 101,
      product_name: 'Гальмівний диск',
      reorder_point: 9,
      suggested_qty: 7.5,
      urgency: 'critical',
      vendor_code: 'BR-101',
    },
  ],
  top_n: 15,
  urgency_mix: [
    { count: 3, urgency: 'critical' },
    { count: 4, urgency: 'high' },
    { count: 8, urgency: 'normal' },
    { count: 10, urgency: 'none' },
  ],
}

describe('ProcureDashboardTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canMock.mockReturnValue(true)
    vi.mocked(getSupplyDashboardSuppliers).mockResolvedValue([
      { FullName: 'Meyle GmbH', Id: 42 },
    ])
    vi.mocked(getSupplyDashboardCharts).mockResolvedValue(charts)
  })

  it('does not mount dashboard requests without supply-dashboard page access', () => {
    canMock.mockReturnValue(false)

    render(
      <MemoryRouter>
        <I18nProvider>
          <MantineProvider theme={theme}>
            <ProcureDashboardTab />
          </MantineProvider>
        </I18nProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Недостатньо прав для перегляду дашборда постачання')).not.toBeNull()
    expect(getSupplyDashboardSuppliers).not.toHaveBeenCalled()
    expect(getSupplyDashboardCharts).not.toHaveBeenCalled()
  })

  it('renders an actionable procurement summary and applies the dashboard filters', async () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <MantineProvider theme={theme}>
            <ProcureDashboardTab />
          </MantineProvider>
        </I18nProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Дашборд постачання')).not.toBeNull()
    expect(
      screen.getByText('Всього позицій').closest('article')?.textContent,
    ).toContain('25')
    expect(
      screen.getByText('Потребують уваги').closest('article')?.textContent,
    ).toContain('7')
    expect(screen.getAllByText('Критична').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Бракує до точки').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Гальмівний диск').length).toBeGreaterThan(0)
    expect(screen.getAllByText('BR-101').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Meyle').length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(getSupplyDashboardSuppliers).toHaveBeenCalledOnce()
    })
    fireEvent.click(screen.getByRole('combobox', { name: 'Постачальник' }))
    fireEvent.click(await screen.findByText('Meyle GmbH'))
    fireEvent.change(screen.getByLabelText('Топ позицій'), {
      target: { value: '8' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати' }))

    await waitFor(() => {
      expect(getSupplyDashboardCharts).toHaveBeenLastCalledWith(
        { producerId: 42, topN: 8 },
        expect.any(AbortSignal),
      )
    })
  })

  it('shows a readable error with retry instead of raw upstream details', async () => {
    vi.mocked(getSupplyDashboardCharts).mockRejectedValueOnce(new Error('ProcurementApi: upstream request failed.')).mockResolvedValue(charts)
    render(<MemoryRouter><I18nProvider><MantineProvider theme={theme}><ProcureDashboardTab /></MantineProvider></I18nProvider></MemoryRouter>)

    expect(await screen.findByText('Не вдалося завантажити дашборд постачання')).not.toBeNull()
    expect(screen.queryByText('ProcurementApi: upstream request failed.')).toBeNull()
    expect(screen.queryByText('Даних для аналізу поки немає')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Повторити' }))
    expect(await screen.findByText('Всього позицій')).not.toBeNull()
    expect(screen.queryByText('Не вдалося завантажити дашборд постачання')).toBeNull()
  })

  it('replaces empty charts with one meaningful operational state', async () => {
    vi.mocked(getSupplyDashboardCharts).mockResolvedValue({
      as_of_date: '2026-07-25',
      source_history_start: '2025-01-01',
      effective_start: '2025-07-25',
      effective_history_days: 365,
      history_complete: true,
      history_not_applicable: ['inventory', 'reservations', 'purchase_costs'],
      ...fixtureCostContext(),
      days_of_cover_hist: [],
      demand_series: [],
      model_version: 'test',
      producer_id: null,
      top_items: [],
      top_n: 15,
      urgency_mix: [],
    })

    render(
      <MemoryRouter>
        <I18nProvider>
          <MantineProvider theme={theme}>
            <ProcureDashboardTab />
          </MantineProvider>
        </I18nProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Даних для аналізу поки немає')).not.toBeNull()
    expect(screen.getByText('Немає даних про запаси та попит.')).not.toBeNull()
    expect(screen.queryByText('Терміновість поповнення')).toBeNull()
    expect(screen.queryByText('Запас днів покриття')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Відкрити конструктор закупівель' }),
    ).not.toBeNull()
  })

  it('switches analytical modes without fetching again and opens the clicked priority product', async () => {
    renderDashboard()
    await screen.findByText('Всього позицій')
    expect(screen.getByLabelText('Терміновість поповнення')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Покриття' }))
    expect(screen.getByLabelText('Запас днів покриття')).not.toBeNull()
    expect(screen.queryByLabelText('Терміновість поповнення')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Попит' }))
    expect(screen.getByRole('combobox', { name: 'Товар для аналізу' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Факт' })).not.toBeNull()
    expect(getSupplyDashboardCharts).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByText('Гальмівний диск'))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText('Аналітика товару')).not.toBeNull()
    expect(within(drawer).getByText('7,5')).not.toBeNull()
    expect(within(drawer).getByRole('button', { name: 'Відкрити в конструкторі' })).not.toBeNull()
    expect(getSupplyDashboardCharts).toHaveBeenCalledOnce()
  })

  it('scopes KPI filtering to the top-item selection and preserves actual global counts', async () => {
    vi.mocked(getSupplyDashboardCharts).mockResolvedValue({ ...charts, top_items: [
      charts.top_items[0], { ...charts.top_items[0], product_id: 102, product_name: 'Інший товар', urgency: 'normal' },
    ] })
    renderDashboard()
    await screen.findByText('Інший товар')
    expect(screen.getByText('Рекомендовано в добірці').closest('article')?.textContent).toContain('15')
    fireEvent.click(screen.getByRole('button', { name: /Критичні позиції/ }))
    expect(screen.queryByText('Інший товар')).toBeNull()
    expect(screen.getByText('Критичні в добірці ×')).not.toBeNull()
    expect(screen.getByText('Всього позицій').closest('article')?.textContent).toContain('25')
    fireEvent.click(screen.getByRole('button', { name: /Критичні в добірці/ }))
    expect(screen.getByText('Інший товар')).not.toBeNull()
    expect(getSupplyDashboardCharts).toHaveBeenCalledOnce()
  })

  it('preserves fractional quantities in summary, priority cells, product details and chart inspection', async () => {
    vi.mocked(getSupplyDashboardCharts).mockResolvedValue({
      ...charts,
      top_items: [{ ...charts.top_items[0], suggested_qty: 0.021, on_hand: 0.004, reorder_point: 0.025 }],
      demand_series: [{ product_id: 101, points: [
        { is_forecast: false, period: '2026-06', units: 0.004 },
        { is_forecast: true, period: '2026-07', units: 0.021 },
      ] }],
    })
    renderDashboard()
    await screen.findByText('Гальмівний диск')
    expect(screen.getByText('Рекомендовано в добірці').closest('article')?.querySelector('strong')?.textContent).toBe('0,021')
    const productRow = screen.getByText('Гальмівний диск').closest('tr')!
    expect(within(productRow).getAllByText('0,021').length).toBeGreaterThan(0)
    expect(within(productRow).getByText('0,004')).not.toBeNull()
    expect(within(productRow).getByText('0,025')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Попит' }))
    expect(screen.getByRole('button', { name: 'Прогноз' }).textContent).toContain('0,021')
    fireEvent.keyDown(screen.getByRole('group', { name: 'Графік: Кількість' }), { key: 'Home' })
    expect(screen.getByRole('button', { name: 'Факт' }).textContent).toContain('0,004')

    fireEvent.click(screen.getByText('Гальмівний диск'))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText('В наявності').closest('article')?.textContent).toContain('0,004')
    expect(within(drawer).getByText('Рекомендовано').closest('article')?.textContent).toContain('0,021')
  })

  it('keeps the last successful scope when applying a different producer fails', async () => {
    renderDashboard()
    await screen.findByText('Всього позицій')
    vi.mocked(getSupplyDashboardCharts).mockRejectedValueOnce(new Error('unavailable'))
    fireEvent.click(screen.getByRole('combobox', { name: 'Постачальник' }))
    fireEvent.click(await screen.findByText('Meyle GmbH'))
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати' }))
    await screen.findByText('Не вдалося завантажити дашборд постачання')
    expect(document.querySelector('.procurement-dashboard__snapshot')?.textContent).toContain('Усі постачальники')
    expect(screen.getByText('Всього позицій').closest('article')?.textContent).toContain('25')
  })

  it('does not expose constructor navigation without its page permission', async () => {
    canMock.mockImplementation((permission) => permission !== PermissionKeys.SystemPages.PurchaseCockpit.View)
    renderDashboard()
    await screen.findByText('Гальмівний диск')
    fireEvent.click(screen.getByText('Гальмівний диск'))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).queryByRole('button', { name: 'Відкрити в конструкторі' })).toBeNull()
  })

  it('paginates priority positions and explains absent product forecasts in the drawer', async () => {
    vi.mocked(getSupplyDashboardCharts).mockResolvedValue({ ...charts, top_items: Array.from({ length: 21 }, (_, index) => ({
      ...charts.top_items[0], product_id: index + 200, product_name: `Товар ${index + 1}`, vendor_code: `CODE-${index + 1}`,
    })) })
    renderDashboard()
    await screen.findByText('Товар 1')
    expect(screen.queryByText('Товар 21')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
    expect(screen.getByText('Товар 21')).not.toBeNull()
    expect(screen.queryByText('Товар 1')).toBeNull()
    fireEvent.click(screen.getByText('Товар 21'))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText('Прогнозу для цього товару немає')).not.toBeNull()
    expect(within(drawer).queryByRole('button', { name: 'Прогноз' })).toBeNull()
  })
})

function renderDashboard() {
  return render(<MemoryRouter><I18nProvider><MantineProvider theme={theme}><ProcureDashboardTab /></MantineProvider></I18nProvider></MemoryRouter>)
}
