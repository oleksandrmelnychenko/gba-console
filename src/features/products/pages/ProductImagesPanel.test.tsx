import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { updateProductWithImages } from '../api/productsApi'

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: (key: string) => key === PermissionKeys.ProductsAssortment.Image.Upload }),
}))
vi.mock('../api/productsApi', async (original) => ({
  ...await original<typeof import('../api/productsApi')>(),
  updateProductWithImages: vi.fn(),
}))

import { ProductActionDrawer } from './ProductDetailPage'

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function file(name: string, head: number[] | string, size = 200): File {
  const start = typeof head === 'string' ? new TextEncoder().encode(head) : new Uint8Array(head)
  const bytes = new Uint8Array(Math.max(size, start.length))
  bytes.set(start)
  return new File([bytes], name, { type: 'image/png' })
}

function renderImages() {
  render(
    <MemoryRouter>
      <MantineProvider>
        <I18nProvider>
          <ProductActionDrawer
            activePanel="images"
            product={{ Id: 7, NetUid: 'product-7', NameUA: 'Товар', ProductImages: [] }}
            onClose={vi.fn()}
            onProductSaved={vi.fn()}
            onReload={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
  return document.querySelector('input[type="file"]') as HTMLInputElement
}

function pick(input: HTMLInputElement, files: File[]) {
  fireEvent.change(input, { target: { files } })
}

describe('product image picker', () => {
  beforeEach(() => {
    vi.mocked(updateProductWithImages).mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects non-image content and empty files by their bytes, with a Ukrainian error', async () => {
    const input = renderImages()
    expect(input.getAttribute('accept')).toBe('image/jpeg,image/png,image/gif,image/webp')

    pick(input, [file('fake.jpg', 'plain text pretending to be a jpeg'), file('empty.png', PNG_HEAD, 1)])

    expect(await screen.findByText(/«fake\.jpg»: не є зображенням JPEG, PNG, GIF або WEBP/)).toBeTruthy()
    expect(screen.getByText(/«empty\.png»: порожній або пошкоджений/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Зберегти' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('stops waiting for an upload that never answers and lets the user retry', async () => {
    vi.mocked(updateProductWithImages).mockImplementation((_product, _files, _mode, signal) => new Promise((_, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const input = renderImages()
    pick(input, [file('photo.png', PNG_HEAD)])
    const save = screen.getByRole('button', { name: 'Зберегти' }) as HTMLButtonElement
    await waitFor(() => expect(save.disabled).toBe(false))

    vi.useFakeTimers()
    fireEvent.click(save)
    fireEvent.click(save)
    expect(updateProductWithImages).toHaveBeenCalledTimes(1)
    expect(save.disabled).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })
    vi.useRealTimers()

    expect(await screen.findByText(/Сервер не відповів вчасно/)).toBeTruthy()
    expect(save.disabled).toBe(false)
  })
})
