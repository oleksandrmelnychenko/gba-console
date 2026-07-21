import { MantineProvider } from '@mantine/core'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'

const getProductSourcePriceComparison = vi.fn()

vi.mock('../api/productsApi', () => ({
  getProductSourcePriceComparison: (...args: unknown[]) => getProductSourcePriceComparison(...args),
}))

import { ProductPriceSourcePanel } from './ProductPriceSourcePanel'

afterEach(() => {
  getProductSourcePriceComparison.mockReset()
})

describe('ProductPriceSourcePanel', () => {
  it('shows only the AMG and Контех tabs and opens on AMG', async () => {
    getProductSourcePriceComparison.mockResolvedValue({
      Amg: {
        IsAvailable: true,
        IsLinked: true,
        Prices: [{ PriceEur: 1.7514, PricingName: 'ЦО1' }],
      },
      Fenix: {
        IsAvailable: true,
        IsLinked: true,
        Prices: [{ PriceEur: 2.002, PricingName: 'ЦО1' }],
      },
      LocalCurrencyCode: 'UAH',
      ProductNetId: 'product-source-panel-1',
    })

    const view = renderPanel('product-source-panel-1')

    await waitFor(() => {
      expect(getProductSourcePriceComparison).toHaveBeenCalledWith(
        'product-source-panel-1',
        expect.any(AbortSignal),
      )
    })
    expect(await view.findByText('1,75')).toBeTruthy()
    expect(view.getByRole('radio', { name: 'AMG' })).toBeTruthy()
    expect(view.getByRole('radio', { name: 'Контех' })).toBeTruthy()
    expect(view.queryByRole('radio', { name: 'Порівняти' })).toBeNull()
  })

  it('switches between the AMG and Контех sources', async () => {
    getProductSourcePriceComparison.mockResolvedValue({
      Amg: {
        IsAvailable: true,
        IsLinked: true,
        Prices: [{ PriceEur: 1.4, PricingName: 'ЦО2' }],
      },
      Fenix: {
        IsAvailable: true,
        IsLinked: true,
        Prices: [{ PriceEur: 1.54, PricingName: 'ЦО2' }],
      },
      LocalCurrencyCode: 'UAH',
      ProductNetId: 'product-source-panel-2',
    })

    const view = renderPanel('product-source-panel-2')

    expect(await view.findByText('1,40')).toBeTruthy()
    fireEvent.click(view.getByRole('radio', { name: 'Контех' }))
    expect(await view.findByText('1,54')).toBeTruthy()
  })

  it('orders prices as base/VAT pairs following the effective price order', async () => {
    getProductSourcePriceComparison.mockResolvedValue({
      Amg: {
        IsAvailable: true,
        IsLinked: true,
        Prices: [
          { PriceEur: 6, PricingName: 'ЦО2 (НДС)' },
          { PriceEur: 1, PricingName: 'ЦР' },
          { PriceEur: 3, PricingName: 'ЦО1' },
          { PriceEur: 2, PricingName: 'ЦР (НДС)' },
          { PriceEur: 5, PricingName: 'ЦО2' },
          { PriceEur: 4, PricingName: 'ЦО1 (НДС)' },
        ],
      },
      Fenix: { IsAvailable: true, IsLinked: true, Prices: [] },
      LocalCurrencyCode: 'UAH',
      ProductNetId: 'product-source-panel-3',
    })

    const view = renderPanel('product-source-panel-3')

    await view.findByText('ЦР')
    const rows = Array.from(view.container.querySelectorAll('.product-inline-price-row'))
      .map((row) => row.querySelector('p')?.textContent?.trim() || '')

    expect(rows).toEqual([
      'ЦР',
      'ЦР (НДС)',
      'ЦО1',
      'ЦО1 (НДС)',
      'ЦО2',
      'ЦО2 (НДС)',
    ])
  })
})

function renderPanel(productNetId: string) {
  return render(
    <MantineProvider theme={theme}>
      <I18nProvider>
        <ProductPriceSourcePanel
          effectivePrices={[
            { Pricing: { Name: 'ЦР' }, RetailPriceEUR: 1, RetailPriceLocal: 42 },
            { Pricing: { Name: 'ЦО1' }, RetailPriceEUR: 1.2, RetailPriceLocal: 50 },
            { Pricing: { Name: 'ЦО2' }, RetailPriceEUR: 1.4, RetailPriceLocal: 71.61 },
          ]}
          productNetId={productNetId}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}
