import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import { getProcurementCharts } from '../api/procurementApi'
import type { ProcurementCharts } from '../procurementTypes'
import { ProcureDashboardTab } from './ProcureDashboardTab'

vi.mock('../api/procurementApi', () => ({
  getProcurementCharts: vi.fn(),
}))

const charts: ProcurementCharts = {
  as_of_date: '2026-07-24',
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
      on_hand: 1,
      product_id: 101,
      reorder_point: 9,
      suggested_qty: 7.5,
      urgency: 'critical',
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
    vi.mocked(getProcurementCharts).mockResolvedValue(charts)
  })

  it('renders an actionable procurement summary and applies the dashboard filters', async () => {
    render(
      <I18nProvider>
        <MantineProvider theme={theme}>
          <ProcureDashboardTab />
        </MantineProvider>
      </I18nProvider>,
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

    fireEvent.change(screen.getByLabelText('Виробник (ID)'), {
      target: { value: '42' },
    })
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
})
