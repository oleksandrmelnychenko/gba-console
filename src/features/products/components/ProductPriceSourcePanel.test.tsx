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
  it('loads the AMG/Fenix comparison immediately', async () => {
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
    expect(await view.findByText('+0,25')).toBeTruthy()
    expect(await view.findByText('AMG: актуальне')).toBeTruthy()
    expect(await view.findByText('Контех: актуальне')).toBeTruthy()
    expect(view.queryByText('У GBA')).toBeNull()
  })

  it('switches between each source and the comparison', async () => {
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

    await view.findByText('+0,14')
    fireEvent.click(view.getByRole('radio', { name: 'AMG' }))
    expect(await view.findByText('1,40')).toBeTruthy()
    fireEvent.click(view.getByRole('radio', { name: 'Контех' }))
    expect(await view.findByText('1,54')).toBeTruthy()
  })
})

function renderPanel(productNetId: string) {
  return render(
    <MantineProvider theme={theme}>
      <I18nProvider>
        <ProductPriceSourcePanel
          effectivePrices={[{
            Pricing: { Name: 'ЦО2' },
            RetailPriceEUR: 1.4,
            RetailPriceLocal: 71.61,
          }]}
          productNetId={productNetId}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}
