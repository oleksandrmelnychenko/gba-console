import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import {
  getAssortmentHealth,
  getAssortmentMargin,
  getAssortmentOverview,
  getAssortmentRegions,
  getAssortmentReturns,
  getAssortmentStock,
} from '../api/assortmentApi'
import type { AssortmentRow } from '../types'
import { AssortmentDashboardPage } from './AssortmentDashboardPage'

vi.mock('../api/assortmentApi', () => ({
  getAssortmentHealth: vi.fn(),
  getAssortmentMargin: vi.fn(),
  getAssortmentOverview: vi.fn(),
  getAssortmentRegions: vi.fn(),
  getAssortmentReturns: vi.fn(),
  getAssortmentStock: vi.fn(),
}))

const product: AssortmentRow = {
  abc: 'A',
  annual_units: 18,
  avg_price_eur: 42,
  band: 'understock',
  cover_days: 4,
  eur_value: 126,
  health: 28,
  lifecycle: 'growing',
  margin_pct: 0.24,
  name: 'Гальмівний диск передній',
  product_id: 501,
  qty_on_hand: 3,
  return_rate: 0.03,
  revenue_eur: 756,
  unit_cost_eur: 31.5,
  vendor_code: 'BR-501',
  xyz: 'X',
}

function mockAssortmentData(rows: AssortmentRow[] = [product]) {
  vi.mocked(getAssortmentOverview).mockResolvedValue({
    ...history(),
    count: rows.length,
    overview: {
      avg_health: rows.length ? 28 : 0,
      by_abc: rows.length ? { A: 1 } : {},
      by_band: rows.length ? { understock: 1 } : {},
      by_lifecycle: rows.length ? { growing: 1 } : {},
      by_xyz: rows.length ? { X: 1 } : {},
      total_eur_value: rows.length ? 126 : 0,
      total_revenue_eur: rows.length ? 756 : 0,
      total_skus: rows.length,
    },
  })
  vi.mocked(getAssortmentHealth).mockResolvedValue({ ...history(), count: rows.length, tasks: rows })
  vi.mocked(getAssortmentRegions).mockResolvedValue({ ...history(), count: 0, regions: [], window_days: 365 })
  vi.mocked(getAssortmentStock).mockResolvedValue({
    ...history(),
    bands: rows.length ? { understock: { count: 1, eur_value: 126, qty: 3 } } : {},
    rows: rows.map((row) => ({
      band: row.band,
      cover_days: row.cover_days,
      eur_value: row.eur_value,
      name: row.name,
      product_id: row.product_id,
      qty_on_hand: row.qty_on_hand,
      vendor_code: row.vendor_code,
    })),
    total_eur_value: rows.length ? 126 : 0,
    total_qty: rows.length ? 3 : 0,
    total_skus: rows.length,
  })
  vi.mocked(getAssortmentMargin).mockResolvedValue({
    ...history(),
    laggards: rows.map((row) => ({
      ...row,
      margin_eur: row.margin_pct == null ? null : row.margin_pct * row.revenue_eur,
    })),
    leaders: [],
    negative: [],
    summary: {
      revenue_eur_known_margin: rows.length ? 756 : 0,
      weighted_avg_margin_pct: rows.length ? 0.24 : null,
    },
  })
  vi.mocked(getAssortmentReturns).mockResolvedValue({
    ...history(),
    high_returns: [],
    summary: { overall_return_rate: rows.length ? 0.03 : 0 },
  })
}

function history() {
  return {
    as_of: '2026-07-10',
    source_history_start: '2025-01-01',
    requested_start: '2025-07-10',
    effective_start: '2025-07-10',
    history_complete: true,
    history_fingerprint: 'products-history-20250101',
    history_windows: {
      portfolio: {
        source_history_start: '2025-01-01',
        requested_start: '2025-07-10',
        effective_start: '2025-07-10',
        effective_days: 365,
        history_complete: true,
      },
    },
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <MantineProvider theme={theme}>
          <AssortmentDashboardPage />
        </MantineProvider>
      </I18nProvider>
    </MemoryRouter>,
  )
}

describe('AssortmentDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAssortmentData()
  })

  it('puts the actionable product table first and keeps product names visually meaningful', async () => {
    renderPage()

    expect(await screen.findByText('Аналітика асортименту')).not.toBeNull()
    expect(screen.getAllByText('Гальмівний диск передній').length).toBeGreaterThan(0)
    expect(screen.getAllByText('BR-501').length).toBeGreaterThan(0)
    expect(screen.getByText('Поповнити запас')).not.toBeNull()
    expect(screen.getByText('Запас нижче розрахованої потреби')).not.toBeNull()
    expect(screen.getByText('Потребують уваги')).not.toBeNull()
    expect(
      screen.getByText('Структура запасів за станом').closest('.assort-dash__insights')?.children,
    ).toHaveLength(3)
    expect(screen.queryByText('#501')).toBeNull()
    expect(screen.getByRole('combobox', { name: 'ABC' })).not.toBeNull()
    expect(screen.getByRole('combobox', { name: 'XYZ' })).not.toBeNull()
    expect(screen.getByRole('combobox', { name: 'Наявність' })).not.toBeNull()

    fireEvent.change(screen.getByLabelText('Дата зрізу'), { target: { value: '2026-07-25' } })

    await waitFor(() => {
      expect(getAssortmentHealth).toHaveBeenLastCalledWith(
        expect.objectContaining({ asOfDate: '2026-07-25', stockedOnly: true }),
        expect.any(AbortSignal),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'Скинути' }))

    await waitFor(() => {
      expect(getAssortmentHealth).toHaveBeenLastCalledWith(
        expect.not.objectContaining({ asOfDate: '2026-07-25' }),
        expect.any(AbortSignal),
      )
    })
  })

  it('shows a meaningful filtered empty state instead of a blank table', async () => {
    mockAssortmentData([])
    renderPage()

    expect(await screen.findByText('За вибраними фільтрами товарів не знайдено')).not.toBeNull()
    expect(screen.getByText('Змініть стан, класифікацію або наявність')).not.toBeNull()
    expect(screen.getByText('Критичних відхилень не знайдено')).not.toBeNull()
  })
})
