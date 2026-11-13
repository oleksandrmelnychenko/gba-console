import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  getProduct,
  getProductAnalytics,
  getProductRegions,
  getProductSubstitutes,
} from '../api/assortmentApi'
import type { ProductDetail } from '../types'
import { ProductCard } from './ProductCard'

vi.mock('../api/assortmentApi', () => ({
  getProduct: vi.fn(),
  getProductAnalytics: vi.fn(),
  getProductRegions: vi.fn(),
  getProductSubstitutes: vi.fn(),
}))

vi.mock('./ProductSalesAnalytics', () => ({
  ProductSalesAnalytics: () => <div data-testid="sales-analytics" />,
}))

describe('ProductCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getProduct).mockResolvedValue(buildProduct())
    vi.mocked(getProductAnalytics).mockResolvedValue({} as never)
    vi.mocked(getProductSubstitutes).mockResolvedValue({
      ...history(),
      candidates: [],
      count: 0,
      found: true,
      in_stock_count: 0,
      product_id: 18_286,
    })
    vi.mocked(getProductRegions).mockResolvedValue({
      ...history(),
      count: 0,
      product_id: 18_286,
      regions: [],
      window_days: 365,
    })
  })

  it('shows the reason the service gives for an unknown product', async () => {
    const reason = 'Товар не знайдено в каталозі або він не має даних для аналітики асортименту.'
    vi.mocked(getProduct).mockRejectedValue(
      new ApiError(reason, 404, { ErrorCode: 'product_not_found', Message: reason }),
    )
    render(<MantineProvider><I18nProvider><ProductCard productId={1} /></I18nProvider></MantineProvider>)
    expect(await screen.findByText(reason)).not.toBeNull()
  })

  it('replaces a technical 404 text with a readable one', async () => {
    vi.mocked(getProduct).mockRejectedValue(
      new ApiError('ProductsApi: requested resource was not found.', 404, { ErrorCode: 'ai_not_found', Message: 'ProductsApi: requested resource was not found.' }),
    )
    render(<MantineProvider><I18nProvider><ProductCard productId={1} /></I18nProvider></MantineProvider>)
    expect(await screen.findByText('Товар не знайдено в аналітиці асортименту')).not.toBeNull()
    expect(screen.queryByText(/ProductsApi/)).toBeNull()
  })

  it('names why a product has no ABC class and that stock is current', async () => {
    vi.mocked(getProduct).mockResolvedValue({
      ...buildProduct(), abc: 'unknown', abc_status: 'no_sales', abc_label: 'Без продажів за період',
      stock_as_of: '2026-11-13', stock_basis: 'current', stock_matches_as_of: false,
    })
    render(<MantineProvider><I18nProvider><ProductCard productId={18_286} /></I18nProvider></MantineProvider>)
    expect(await screen.findByText('Внесок у продажі: Без продажів за період')).not.toBeNull()
    expect(screen.getByTestId('product-stock-as-of').textContent).toBe('залишок і собівартість — на сьогодні (13.11.2026)')
  })

  it('shows no stock note when stock matches the report date', async () => {
    vi.mocked(getProduct).mockResolvedValue({ ...buildProduct(), stock_matches_as_of: true })
    render(<MantineProvider><I18nProvider><ProductCard productId={18_286} /></I18nProvider></MantineProvider>)
    await screen.findByTestId('sales-analytics')
    expect(screen.queryByTestId('product-stock-as-of')).toBeNull()
  })

  it('keeps substitutes identifiable and preserves precise regional figures when expanding', async () => {
    vi.mocked(getProductSubstitutes).mockResolvedValue({
      ...history(), found: true, product_id: 18_286, count: 7, in_stock_count: 7,
      candidates: Array.from({ length: 7 }, (_, index) => ({ ...buildProduct(), product_id: index + 1, vendor_code: `ALT-${index + 1}`, name: 'Однакова назва', qty_on_hand: 0.25 })),
    })
    vi.mocked(getProductRegions).mockResolvedValue({
      ...history(), count: 1, product_id: 18_286, window_days: 365,
      regions: [{ product_id: 18_286, region_id: 1, region_name: 'Київ', regional_units: 0.25, regional_order_count: 2, regional_client_count: 1, regional_revenue_eur: 0.49 }],
    })
    render(<MantineProvider><I18nProvider><ProductCard productId={18_286} regionId={1} /></I18nProvider></MantineProvider>)
    const substitutes = await screen.findByRole('region', { name: 'Доступні замінники' })
    expect(within(substitutes).getAllByRole('row')).toHaveLength(7)
    expect(screen.queryByText('ALT-7')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Показати всі · 7' }))
    expect(screen.getByText('ALT-7')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Згорнути' }))
    expect(screen.queryByText('ALT-7')).toBeNull()
    const regions = screen.getByRole('region', { name: 'Де купують товар' })
    expect(within(regions).getByText('0,25')).toBeTruthy()
    expect(within(regions).getByText('0,49')).toBeTruthy()
    expect(within(regions).getByText('Київ').closest('tr')?.getAttribute('aria-current')).toBe('true')
  })

  it('labels margin and profit as ex-VAT and shows unvalued stock honestly', async () => {
    vi.mocked(getProduct).mockResolvedValue({
      ...buildProduct(),
      margin_ex_vat_eur: 1234.4,
      margin_pct: 0.2,
      revenue_ex_vat_eur: 6172,
      stock_value_eur: null,
    })
    render(
      <MantineProvider>
        <I18nProvider>
          <ProductCard productId={18_286} />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(await screen.findByText('Оцінена маржа, без ПДВ')).toBeTruthy()
    expect(screen.getByText('Не оцінено: немає собівартості')).toBeTruthy()
    const profit = screen.getByText('Оцінений прибуток, без ПДВ').parentElement as HTMLElement
    expect(profit.textContent).toMatch(/1\s234/)
    expect(screen.getByText('Продажі до повернень, без ПДВ')).toBeTruthy()
    expect(screen.getByText('Продажі до повернень, з ПДВ')).toBeTruthy()
  })

  it('keeps the stock value and hides ex-VAT figures for a payload without the new fields', async () => {
    render(
      <MantineProvider>
        <I18nProvider>
          <ProductCard productId={18_286} />
        </I18nProvider>
      </MantineProvider>,
    )

    const stock = (await screen.findByText('Вартість залишку за собівартістю')).parentElement as HTMLElement
    expect(stock.textContent).toContain('114')
    expect(screen.queryByText('Оцінений прибуток, без ПДВ')).toBeNull()
    expect(screen.queryByText('Продажі до повернень, без ПДВ')).toBeNull()
  })

  it('explains the product scores and empty states in business language', async () => {
    render(
      <MantineProvider>
        <I18nProvider>
          <ProductCard productId={18_286} />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(await screen.findByText('Амортизатор')).toBeTruthy()
    expect(screen.getAllByText('21/100')).toHaveLength(1)
    expect(screen.getByText('Рекомендація')).toBeTruthy()
    expect(screen.getByText('Перевірити залишок без продажів')).toBeTruthy()
    expect(screen.getByText('Товар давно не продавався')).toBeTruthy()
    expect(screen.getByText('Вільний залишок, од. виміру')).toBeTruthy()
    expect(screen.getByText('Запасу вистачить')).toBeTruthy()
    expect(screen.getByText('Загальна оцінка товару')).toBeTruthy()
    expect(screen.getByText('Попит на товар')).toBeTruthy()
    expect(screen.getByText('Прибутковість і повернення')).toBeTruthy()
    expect(screen.getByText('Внесок у продажі: низький (клас C)')).toBeTruthy()
    expect(screen.getByText('Регулярність попиту: нерегулярний (клас Z)')).toBeTruthy()
    expect(screen.getByText('Стан запасу: без продажів')).toBeTruthy()
    expect(screen.getByText('Стадія попиту: без продажів')).toBeTruthy()
    expect(screen.getByText('Повернень не було')).toBeTruthy()
    expect(screen.getByText('Замінників у наявності не знайдено.')).toBeTruthy()
    expect(screen.getByText('За обраний період продажів у регіонах не було.')).toBeTruthy()
    expect(screen.getByText('Загальна оцінка товару').closest('details')?.open).toBe(false)
    expect(screen.getByText('SEM OTOMOTIV DIS TICARET LTD.STI.').closest('.app-table-chip')?.className).toContain('is-document')
    expect(screen.queryByText(/^Health$/)).toBeNull()
    expect(screen.queryByText(/^ABC C$/)).toBeNull()
    expect(screen.queryByText(/^XYZ Z$/)).toBeNull()
    expect(screen.queryByText(/мертвий/)).toBeNull()
  })
})

function buildProduct(): ProductDetail {
  return {
    ...history(),
    abc: 'C',
    action_label: 'dead_stock_review',
    action_reasons: ['dead_stock'],
    annual_units: 0,
    avg_price_eur: null,
    band: 'dead',
    cover_days: null,
    demand_components: {
      abc: 0.2,
      stability: 0.3,
      stock: 0,
      trend: 0,
    },
    demand_score: 16,
    eur_value: 114,
    found: true,
    health: 21,
    health_components: {
      abc: 0.2,
      margin: 0.5,
      returns: 1,
      stability: 0.3,
      stock: 0,
      trend: 0,
    },
    lifecycle: 'dead',
    margin_components: {
      abc: 0.2,
      margin: 0.5,
      returns: 1,
    },
    margin_pct: null,
    margin_score: 57,
    name: 'Амортизатор',
    primary_producer_id: 7,
    primary_producer_name: 'SEM OTOMOTIV DIS TICARET LTD.STI.',
    product_id: 18_286,
    qty_on_hand: 4,
    return_rate: 0,
    revenue_eur: 0,
    unit_cost_eur: 28.39,
    vendor_code: 'SEM18286',
    xyz: 'Z',
  }
}

function history() {
  return {
    as_of: '2026-07-25',
    effective_start: '2025-07-25',
    history_complete: true,
    history_fingerprint: 'products-history-20250101',
    history_windows: {
      annual: {
        effective_days: 365,
        effective_start: '2025-07-25',
        history_complete: true,
        requested_start: '2025-07-25',
        source_history_start: '2025-01-01',
      },
    },
    requested_start: '2025-07-25',
    source_history_start: '2025-01-01',
  }
}
