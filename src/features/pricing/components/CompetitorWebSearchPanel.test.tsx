import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { searchCompetitorPrices } from '../api/pricingApi'
import { CompetitorWebSearchPanel } from './CompetitorWebSearchPanel'

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: mocks.can }),
}))

vi.mock('../api/pricingApi', () => ({
  searchCompetitorPrices: vi.fn(),
}))

const searchCompetitorPricesMock = vi.mocked(searchCompetitorPrices)

beforeEach(() => {
  searchCompetitorPricesMock.mockReset()
  mocks.can.mockReturnValue(true)
})

describe('CompetitorWebSearchPanel', () => {
  it('does not expose or execute market scan without its business permission', () => {
    mocks.can.mockReturnValue(false)

    render(
      <MantineProvider env="test" theme={{ respectReducedMotion: true }}>
        <I18nProvider>
          <CompetitorWebSearchPanel product={{ MainOriginalNumber: 'OE-1' }} />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.queryByRole('button', { name: 'Знайти ціни' })).toBeNull()
    fireEvent.keyDown(screen.getByLabelText('Пошуковий запит'), {
      key: 'Enter',
    })
    expect(searchCompetitorPricesMock).not.toHaveBeenCalled()
  })

  it('expands and collapses the Anthropic production prompt', () => {
    render(
      <MantineProvider env="test" theme={{ respectReducedMotion: true }}>
        <I18nProvider>
          <CompetitorWebSearchPanel product={null} />
        </I18nProvider>
      </MantineProvider>,
    )

    const expandButton = screen.getByRole('button', { name: 'Показати промпт Anthropic' })
    expect(expandButton.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('competitor-search-prompt')).toBeNull()

    fireEvent.click(expandButton)

    const collapseButton = screen.getByRole('button', { name: 'Згорнути промпт Anthropic' })
    expect(collapseButton.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByTestId('competitor-search-prompt').textContent)
      .toContain('Ти — GBA Market Radar')

    fireEvent.click(collapseButton)
    expect(screen.queryByTestId('competitor-search-prompt')).toBeNull()
  })

  it('resets the editable query when the selected product changes', () => {
    const { rerender } = render(
      <MantineProvider env="test" theme={{ respectReducedMotion: true }}>
        <I18nProvider>
          <CompetitorWebSearchPanel
            product={{ MainOriginalNumber: 'OE-1', Name: 'First product', VendorCode: 'SKU-1' }}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    const input = screen.getByLabelText<HTMLInputElement>('Пошуковий запит')
    expect(input.value).toBe('OE-1 SKU-1 First product')

    fireEvent.change(input, { target: { value: 'custom query' } })
    expect(input.value).toBe('custom query')

    rerender(
      <MantineProvider env="test" theme={{ respectReducedMotion: true }}>
        <I18nProvider>
          <CompetitorWebSearchPanel
            product={{ MainOriginalNumber: 'OE-2', Name: 'Second product', VendorCode: 'SKU-2' }}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(screen.getByLabelText<HTMLInputElement>('Пошуковий запит').value)
      .toBe('OE-2 SKU-2 Second product')
  })

  it('runs the market scan and renders normalized offers', async () => {
    searchCompetitorPricesMock.mockResolvedValue({
      ai_summary: 'Більшість точних пропозицій тримається біля 1 350 ₴.',
      currency: 'UAH',
      market: 'UA',
      offers: [
        {
          availability: 'in_stock',
          delivery_text: 'відправка сьогодні',
          marketplace_name: 'STRANS',
          original_price_uah: 1399,
          price_uah: 1250,
          seller_name: 'Авто Світ',
          similarity_score: 0.97,
          source: 'strans',
          title: 'Bosch OE-1 — точний збіг',
          url: 'https://strans-shop.com.ua/shop/product/887756',
        },
      ],
      query: 'OE-1 SKU-1 First product',
      searched_at: '2026-07-31T11:30:00Z',
      sources_scanned: ['strans'],
    })

    render(
      <MantineProvider env="test" theme={{ respectReducedMotion: true }}>
        <I18nProvider>
          <CompetitorWebSearchPanel
            product={{
              MainOriginalNumber: 'OE-1',
              Name: 'First product',
              NetUid: '11111111-1111-1111-1111-111111111111',
              VendorCode: 'SKU-1',
            }}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Знайти ціни' }))

    expect(await screen.findByText('Ринок знайдено')).not.toBeNull()
    expect(screen.getByText('Bosch OE-1 — точний збіг')).not.toBeNull()
    expect(screen.getAllByText('1 250 ₴').length).toBeGreaterThan(0)
    expect(searchCompetitorPricesMock).toHaveBeenCalledWith({
      market: 'UA',
      product_net_uid: '11111111-1111-1111-1111-111111111111',
      query: 'OE-1 SKU-1 First product',
      sources: ['strans', 'cargo_parts', 'intercars', 'omega', 'tir_market'],
    }, expect.any(AbortSignal))
  })
})
