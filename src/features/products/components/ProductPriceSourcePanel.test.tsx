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
  it('loads source prices only after a source mode is selected', async () => {
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

    expect(getProductSourcePriceComparison).not.toHaveBeenCalled()

    fireEvent.click(view.getByText('Порівняти'))

    await waitFor(() => {
      expect(getProductSourcePriceComparison).toHaveBeenCalledWith(
        'product-source-panel-1',
        expect.any(AbortSignal),
      )
    })
    expect(await view.findByText('+0,25')).toBeTruthy()
    expect(await view.findByText('AMG: актуальне')).toBeTruthy()
    expect(await view.findByText('Контех: актуальне')).toBeTruthy()
  })

  it('keeps the effective prices visible without a source response', () => {
    const view = renderPanel('product-source-panel-2')

    expect(view.getByText('ЦО2')).toBeTruthy()
    expect(view.getByText('1,40')).toBeTruthy()
    expect(getProductSourcePriceComparison).not.toHaveBeenCalled()
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
