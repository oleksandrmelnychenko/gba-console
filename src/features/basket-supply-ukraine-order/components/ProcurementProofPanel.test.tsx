import { fixtureLineCostFields, fixtureCostProof } from '../procurementCostTestFixtures'
import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { getProductAnalytics } from '../../assortment/api/assortmentApi'
import type { ReorderSuggestion } from '../procurementTypes'
import { ProcurementProofPanel } from './ProcurementConstructor'
import { clearProductAnalyticsResource } from './productAnalyticsResource'
import { clearSession, saveSession } from '../../../shared/auth/session'

vi.mock('../../assortment/api/assortmentApi', () => ({
  getProductAnalytics: vi.fn(),
}))

const t = (key: string) => key

describe('ProcurementProofPanel', () => {
  beforeEach(() => { clearSession(); clearProductAnalyticsResource(); vi.mocked(getProductAnalytics).mockReset() })
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

    expect(screen.getByText('Змінено вручну')).not.toBeNull()
    expect(await screen.findByRole('button', { name: 'Дані' })).not.toBeNull()
    await waitFor(() => expect(getProductAnalytics).toHaveBeenCalledWith(100, undefined, 12, expect.any(AbortSignal)))
    fireEvent.click(screen.getByRole('button', { name: 'Дані' }))
    expect(await screen.findByText('черв. 2026 р.')).not.toBeNull()
    expect(screen.queryByText('croston')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Розрахунок' }))
    expect(screen.getByText('Мінімальне замовлення')).not.toBeNull()
    expect(screen.getByText('Обґрунтування вартості')).not.toBeNull()
    expect(getProductAnalytics).toHaveBeenCalledTimes(1)
  })
  it('shows request failures as failures and permits retry', async () => {
    vi.mocked(getProductAnalytics).mockRejectedValueOnce(new Error('network'))
    vi.mocked(getProductAnalytics).mockResolvedValueOnce({ sales_series: [] } as unknown as Awaited<ReturnType<typeof getProductAnalytics>>)
    render(<MantineProvider theme={theme}><ProcurementProofPanel row={suggestion()} selectedQty={30} t={t} /></MantineProvider>)
    expect((await screen.findByRole('alert')).textContent).toContain('Не вдалося завантажити продажі')
    expect(screen.queryByText('За цей період даних немає')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Повторити' }))
    expect(await screen.findByText('За цей період даних немає')).not.toBeNull()
    expect(getProductAnalytics).toHaveBeenCalledTimes(2)
  })

  it('ignores an old range response and distinguishes missing price from zero', async () => {
    let resolveOld!: (data: Awaited<ReturnType<typeof getProductAnalytics>>) => void
    vi.mocked(getProductAnalytics).mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve }))
    vi.mocked(getProductAnalytics).mockResolvedValueOnce({ sales_series: [{ month: '2026-10', units: 0, revenue_eur: 0, order_count: 0, avg_price_eur: null, is_complete: false }] } as Awaited<ReturnType<typeof getProductAnalytics>>)
    render(<MantineProvider theme={theme}><ProcurementProofPanel row={suggestion()} selectedQty={30} t={t} /></MantineProvider>)
    fireEvent.click(screen.getByRole('button', { name: '3 міс.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Дані' }))
    expect(await screen.findByText('жовт. 2026 р.')).not.toBeNull()
    resolveOld({ sales_series: [] } as unknown as Awaited<ReturnType<typeof getProductAnalytics>>)
    await waitFor(() => expect(screen.getByText('жовт. 2026 р.')).not.toBeNull())
    expect(screen.getByText('Є неповні місяці')).not.toBeNull()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('keeps unavailable table values distinct from real zero', async () => {
    vi.mocked(getProductAnalytics).mockResolvedValueOnce({ sales_series: [{
      month: '2026-10', units: 0, revenue_eur: null, order_count: null,
      avg_price_eur: undefined, is_complete: true,
    }] } as unknown as Awaited<ReturnType<typeof getProductAnalytics>>)
    render(<MantineProvider theme={theme}><ProcurementProofPanel row={suggestion()} selectedQty={30} t={t} /></MantineProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Дані' }))
    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('cell').map((cell) => cell.textContent?.trim())).toEqual(['жовт. 2026 р.', '0', '—', '—', '—'])
    expect(table.textContent).not.toContain('NaN')
  })

  it('replaces already visible history when the authenticated session changes', async () => {
    saveSession({ userNetUid: 'user-a', csrfToken: 'session-a' })
    const payload = (units: number) => ({ sales_series: [{ month: '2026-10', units, revenue_eur: 0, order_count: 0, avg_price_eur: null, is_complete: true }] }) as Awaited<ReturnType<typeof getProductAnalytics>>
    vi.mocked(getProductAnalytics).mockResolvedValueOnce(payload(123)).mockResolvedValueOnce(payload(456))
    render(<MantineProvider theme={theme}><ProcurementProofPanel row={suggestion()} selectedQty={30} t={t} /></MantineProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Дані' }))
    expect(await screen.findByRole('cell', { name: '123' })).not.toBeNull()
    act(() => { saveSession({ userNetUid: 'user-b', csrfToken: 'session-b' }) })
    expect(screen.queryByRole('cell', { name: '123' })).toBeNull()
    expect(await screen.findByRole('cell', { name: '456' })).not.toBeNull()
    expect(getProductAnalytics).toHaveBeenCalledTimes(2)
  })

})

function suggestion(): ReorderSuggestion {
  return {
    ...fixtureLineCostFields(),
    abc: 'A',
    applied_service_level: 0.95,
    cheaper_alt: { cost_eur: 4.1, producer_id: 7, cost_provenance: fixtureCostProof(4.1), comparison_basis: 'historical_net_goods' },
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
    unit_margin_eur: null,
    unit_sale_eur: 7.5,
    urgency: 'critical',
    value_density: null,
    vendor_code: 'BR-2048',
    within_budget: null,
    xyz: 'X',
  }
}
