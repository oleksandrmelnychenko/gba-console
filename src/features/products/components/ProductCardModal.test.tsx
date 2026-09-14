import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'

const getProductByNetId = vi.fn()

vi.mock('../api/productsApi', () => ({
  getProductByNetId: (...args: unknown[]) => getProductByNetId(...args),
}))

vi.mock('./ShopImageGallery', () => ({
  ShopImageGallery: () => null,
}))

import { ProductCardModal } from './ProductCardModal'

describe('ProductCardModal', () => {
  it('renders agreement-scoped prices and keeps the product link available', async () => {
    const loadProduct = vi.fn().mockResolvedValue({
      CurrentLocalPrice: 517.24,
      CurrentPrice: 12.5,
      NameUA: 'Сайлентблок ресори',
      NetUid: 'product-1',
      VendorCode: '40077025TE',
    })

    render(
      <MantineProvider theme={theme}>
        <I18nProvider>
          <ProductCardModal
            loadProduct={loadProduct}
            productNetId="product-1"
            onClose={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(await screen.findByText('517,24')).toBeTruthy()
    expect(screen.getByText('12,50')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Відкрити' }).getAttribute('href'))
      .toBe('/products?netId=product-1')
    expect(loadProduct).toHaveBeenCalledWith('product-1', expect.any(AbortSignal))
  })

  it('aborts the product request when the card unmounts', async () => {
    let requestSignal: AbortSignal | undefined

    getProductByNetId.mockImplementationOnce((_productNetId: string, signal?: AbortSignal) => {
      requestSignal = signal

      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      })
    })

    const view = render(
      <MantineProvider theme={theme}>
        <I18nProvider>
          <ProductCardModal productNetId="product-1" onClose={vi.fn()} />
        </I18nProvider>
      </MantineProvider>,
    )

    await waitFor(() => {
      expect(getProductByNetId).toHaveBeenCalledWith('product-1', expect.any(AbortSignal))
    })

    view.unmount()

    expect(requestSignal?.aborted).toBe(true)
  })
})
