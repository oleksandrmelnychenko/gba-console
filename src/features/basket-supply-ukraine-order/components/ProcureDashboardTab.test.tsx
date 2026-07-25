import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import { getSupplyOrderSuppliers } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import { getProcurementCharts } from '../api/procurementApi'
import type { ProcurementCharts } from '../procurementTypes'
import { ProcureDashboardTab } from './ProcureDashboardTab'

vi.mock('../api/procurementApi', () => ({
  getProcurementCharts: vi.fn(),
}))

vi.mock('../../supply-ukraine-orders/api/supplyUkraineOrdersApi', () => ({
  getSupplyOrderSuppliers: vi.fn(),
}))

const charts: ProcurementCharts = {
  as_of_date: '2026-07-24',
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
    vi.mocked(getSupplyOrderSuppliers).mockResolvedValue([
      { FullName: 'Meyle GmbH', Id: 42 },
    ])
    vi.mocked(getProcurementCharts).mockResolvedValue(charts)
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
      expect(getSupplyOrderSuppliers).toHaveBeenCalledOnce()
    })
    fireEvent.click(screen.getByRole('combobox', { name: 'Виробник' }))
    fireEvent.click(await screen.findByText('Meyle GmbH'))
    fireEvent.change(screen.getByLabelText('Топ позицій'), {
      target: { value: '8' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Застосувати' }))

    await waitFor(() => {
      expect(getProcurementCharts).toHaveBeenLastCalledWith(
        { producerId: 42, topN: 8 },
        expect.any(AbortSignal),
      )
    })
  })

  it('replaces empty charts with one meaningful operational state', async () => {
    vi.mocked(getProcurementCharts).mockResolvedValue({
      as_of_date: '2026-07-25',
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
    expect(screen.getByText(/Поточний запас покриває розраховану потребу/)).not.toBeNull()
    expect(screen.queryByText('Терміновість поповнення')).toBeNull()
    expect(screen.queryByText('Запас днів покриття')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Відкрити конструктор закупівель' }),
    ).not.toBeNull()
  })

  it('opens the selected product forecast in a right-side detail sheet', async () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <MantineProvider theme={theme}>
            <ProcureDashboardTab />
          </MantineProvider>
        </I18nProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Прогноз попиту')).not.toBeNull()
    expect(screen.queryByText('Графік попиту')).toBeNull()

    const openForecastButton = document.querySelector<HTMLButtonElement>(
      '[aria-label="Відкрити графік: Гальмівний диск"]',
    )

    expect(openForecastButton).not.toBeNull()
    fireEvent.click(openForecastButton!)

    expect(await screen.findByText('Динаміка попиту')).not.toBeNull()
    expect(screen.getByText('Графік попиту')).not.toBeNull()
    expect(screen.getByText('Останній факт')).not.toBeNull()
    expect(screen.getByText('Наступний прогноз')).not.toBeNull()
    expect(screen.getByText('Горизонт')).not.toBeNull()
  })
})
