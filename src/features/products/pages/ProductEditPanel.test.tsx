import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { updateProduct } from '../api/productsApi'

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true, user: null }),
}))
vi.mock('../api/productsApi', async (original) => ({
  ...await original<typeof import('../api/productsApi')>(),
  updateProduct: vi.fn(),
}))

import { ProductActionDrawer } from './ProductDetailPage'
import { parseProductWeight } from './productEditForm'

const onReload = vi.fn()

function renderEdit() {
  render(
    <MemoryRouter>
      <MantineProvider>
        <I18nProvider>
          <ProductActionDrawer
            activePanel="edit"
            product={{ Id: 7, NetUid: 'product-7', NameUA: 'Товар', Weight: 6.2, Updated: '2026-11-17T10:00:00' }}
            onClose={vi.fn()}
            onProductSaved={vi.fn()}
            onReload={onReload}
          />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('product edit: weight and conflicts', () => {
  beforeEach(() => {
    vi.mocked(updateProduct).mockReset().mockResolvedValue(null)
    onReload.mockReset()
  })

  it('parses weight strictly', () => {
    const t = (value: string) => value
    expect(parseProductWeight('7,5', t)).toEqual({ error: null, value: 7.5 })
    expect(parseProductWeight('', t)).toEqual({ error: null, value: null })
    expect(parseProductWeight('-5', t).error).toBe('Вага не може бути відʼємною')
    expect(parseProductWeight('abc', t).error).toBe('Вага має бути числом, наприклад 7,5')
    expect(parseProductWeight('99999999999999', t).error).toBe('Вага не може перевищувати 100 000')
  })

  it('shows -5 under «Вага» and sends nothing', async () => {
    renderEdit()
    fireEvent.change(await screen.findByRole('textbox', { name: 'Вага' }), { target: { value: '-5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(await screen.findByText('Вага не може бути відʼємною')).toBeTruthy()
    expect(updateProduct).not.toHaveBeenCalled()
  })

  it('sends the loaded Updated and offers a reload on 409', async () => {
    vi.mocked(updateProduct).mockRejectedValueOnce(Object.assign(new Error('conflict'), { status: 409 }))
    renderEdit()
    fireEvent.change(await screen.findByRole('textbox', { name: 'Вага' }), { target: { value: '8,25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith(
      expect.objectContaining({ Updated: '2026-11-17T10:00:00', Weight: 8.25 }),
    ))
    expect(await screen.findByText(/Товар змінив інший користувач/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Перезавантажити' }))
    expect(onReload).toHaveBeenCalled()
  })
})
