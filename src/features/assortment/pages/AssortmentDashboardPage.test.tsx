import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
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

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

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
    allowedPermissions.clear()
    allowedPermissions.add(PermissionKeys.ProductsAssortment.Analytics.Open)
    vi.clearAllMocks()
    HTMLElement.prototype.scrollIntoView = vi.fn()
    mockAssortmentData()
  })

  it('does not mount analytics without the existing page right', () => {
    allowedPermissions.clear()
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getAssortmentOverview).not.toHaveBeenCalled()
    expect(getAssortmentHealth).not.toHaveBeenCalled()
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

    fireEvent.change(screen.getByLabelText('До дати (не включно)'), { target: { value: '2026-07-25' } })

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

  it('states the basis of stock value, sales and profit figures', async () => {
    renderPage()

    expect(await screen.findByText('Вартість запасів за собівартістю')).not.toBeNull()
    expect(screen.getByText('Продажі до повернень, з ПДВ')).not.toBeNull()
    expect(screen.getByText('Продажі мінус повернення, з ПДВ')).not.toBeNull()
    expect(screen.getAllByText('Запас за собівартістю, €').length).toBeGreaterThan(0)
    expect(screen.queryByText('Надлишок запасу')).toBeNull()
  })

  it('shows stocked positions, unvalued stock and the current-stock note on the stock value tile', async () => {
    mockAssortmentData()
    const base = await vi.mocked(getAssortmentOverview).getMockImplementation()!()
    vi.mocked(getAssortmentOverview).mockResolvedValue({
      ...base,
      overview: {
        ...base.overview,
        stock_as_of: '2026-11-13',
        stock_matches_as_of: false,
        stock_skus: 11288,
        stock_unvalued_qty: 960.5,
        stock_unvalued_skus: 3,
        stock_value_eur: 1923979.83,
        total_eur_value: 5,
        total_skus: 16764,
      },
    })
    renderPage()

    const tile = (await screen.findByText('Вартість запасів за собівартістю')).closest('.kpi-tile') as HTMLElement
    const text = tile.textContent?.replace(/\s/g, ' ') ?? ''
    expect(text).toContain('1 923 979,83')
    expect(text).toContain('Позицій із залишком: 11 288')
    expect(text).not.toContain('16 764')
    expect(text).toContain('без собівартості, не враховано: 3 поз. (960,5 од.)')
    expect(text).toContain('залишок і собівартість — на сьогодні (13.11.2026)')
  })

  it('names why products have no ABC class instead of a bare unknown count', async () => {
    mockAssortmentData()
    const base = await vi.mocked(getAssortmentOverview).getMockImplementation()!()
    vi.mocked(getAssortmentOverview).mockResolvedValue({
      ...base,
      overview: {
        ...base.overview,
        by_abc: { A: 1, unknown: 7 },
        by_abc_status: { classified: 1, no_sales: 6, non_positive_contribution: 1 },
        abc_status_labels: {
          no_sales: 'Без продажів за період',
          non_positive_contribution: 'Продажі перекриті поверненнями або коригуваннями',
        },
      },
    })
    renderPage()

    const chip = (await screen.findByText(/Без продажів за період/)).closest('.assort-mix__chip') as HTMLElement
    expect(chip.textContent).toBe('Без продажів за період 6')
    expect(screen.queryByText(/Без класу/)).toBeNull()
  })

  it('says the stock is not valued when no stocked position has a cost', async () => {
    mockAssortmentData()
    const base = await vi.mocked(getAssortmentOverview).getMockImplementation()!()
    vi.mocked(getAssortmentOverview).mockResolvedValue({
      ...base,
      overview: { ...base.overview, stock_matches_as_of: true, stock_skus: 2, stock_unvalued_skus: 2, stock_value_eur: null },
    })
    renderPage()

    const tile = (await screen.findByText('Вартість запасів за собівартістю')).closest('.kpi-tile') as HTMLElement
    expect(tile.textContent).toContain('Не оцінено')
    expect(tile.textContent).not.toContain('на сьогодні')
  })

  it('keeps the legacy stock value tile for a payload without the new fields', async () => {
    renderPage()

    const tile = (await screen.findByText('Вартість запасів за собівартістю')).closest('.kpi-tile') as HTMLElement
    const text = tile.textContent?.replace(/\s/g, ' ') ?? ''
    expect(text).toContain('126,00')
    expect(text).toContain('Товарних позицій: 1')
    expect(text).not.toContain('без собівартості')
  })

  it('labels margin and profit as ex-VAT with the ex-VAT revenue base', async () => {
    mockAssortmentData()
    const base = await vi.mocked(getAssortmentMargin).getMockImplementation()!()
    vi.mocked(getAssortmentMargin).mockResolvedValue({
      ...base,
      summary: {
        ...base.summary,
        estimated_profit_eur: 484333.32,
        margin_vat_basis: 'ex-vat',
        revenue_ex_vat_eur_known_margin: 2648489.32,
        revenue_eur_known_margin: 3087813.99,
      },
    })
    renderPage()

    const tile = (await screen.findByText('Оцінений прибуток, без ПДВ')).closest('.kpi-tile') as HTMLElement
    const text = tile.textContent?.replace(/\s/g, ' ') ?? ''
    expect(text).toContain('484 333,32')
    expect(text).toContain('їх продажі без ПДВ: 2 648 489,32')
    expect(text).not.toContain('3 087 813,99')
    expect(screen.getAllByText('Оцінена маржа %, без ПДВ').length).toBeGreaterThan(0)
    expect(screen.getByText('Продажі до повернень, з ПДВ')).not.toBeNull()
  })

  it('translates recommendation codes and applies the selected supported row limit', async () => {
    mockAssortmentData([{ ...product, action_reasons: ['negative_margin'] }])
    renderPage()
    expect(await screen.findByText('Продажі приносять збиток')).not.toBeNull()
    expect(screen.queryByText('negative_margin')).toBeNull()

    fireEvent.click(screen.getByRole('combobox', { name: 'Ліміт позицій' }))
    fireEvent.click(screen.getByText('500', { exact: true }))
    await waitFor(() => expect(getAssortmentHealth).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 500 }), expect.any(AbortSignal)))
  })

  it('does not combine an earlier snapshot with partial results after changing the date', async () => {
    renderPage()
    await screen.findByText('Поповнити запас')
    expect(screen.getAllByText('Гальмівний диск передній').length).toBeGreaterThan(0)

    mockAssortmentData([{ ...product, name: 'Товар нового зрізу', vendor_code: 'NEW-1' }])
    vi.mocked(getAssortmentStock).mockRejectedValue(new Error('Stock unavailable'))
    vi.mocked(getAssortmentMargin).mockRejectedValue(new Error('Margin unavailable'))
    fireEvent.change(screen.getByLabelText('До дати (не включно)'), { target: { value: '2026-07-25' } })

    await screen.findByText(/Stock unavailable/)
    expect(screen.getAllByText('Товар нового зрізу').length).toBeGreaterThan(0)
    expect(screen.queryByText('Гальмівний диск передній')).toBeNull()
    expect(screen.queryByText('BR-501')).toBeNull()
  })

  it('shows a meaningful filtered empty state instead of a blank table', async () => {
    mockAssortmentData([])
    renderPage()

    expect(await screen.findByText('За вибраними фільтрами товарів не знайдено')).not.toBeNull()
    expect(screen.getByText('Змініть стан, класифікацію або наявність')).not.toBeNull()
    expect(screen.getByText('Критичних відхилень не знайдено')).not.toBeNull()
  })
})
