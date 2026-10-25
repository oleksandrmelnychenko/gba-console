import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

it('retries a failed compact card without reopening it and shares duplicate clicks', async () => {
  let finish!: (value: { NetUid: string; VendorCode: string }) => void
  const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  render(<MantineProvider><I18nProvider><ProductCardModal productNetId="product-1" onClose={() => {}} loadProduct={load} /></I18nProvider></MantineProvider>)
  const retry = await screen.findByRole('button', { name: 'Повторити завантаження товару' })
  fireEvent.click(retry)
  fireEvent.click(retry)
  expect(load).toHaveBeenCalledTimes(2)
  expect((retry as HTMLButtonElement).disabled).toBe(true)
  await act(async () => finish({ NetUid: 'product-1', VendorCode: 'RECOVERED' }))
  expect(await screen.findByText('RECOVERED')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})
