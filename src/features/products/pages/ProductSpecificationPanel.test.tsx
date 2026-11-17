import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { addProductSpecificationCode } from '../api/productsApi'

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true, user: null }),
}))
vi.mock('../api/productsApi', async (original) => ({
  ...await original<typeof import('../api/productsApi')>(),
  addProductSpecificationCode: vi.fn(),
}))

import { ProductActionDrawer } from './ProductDetailPage'

function renderSpecification() {
  render(
    <MemoryRouter>
      <MantineProvider>
        <I18nProvider>
          <ProductActionDrawer
            activePanel="specification"
            product={{ Id: 7, NetUid: 'product-7', NameUA: 'Товар', ProductSpecifications: [] }}
            onClose={vi.fn()}
            onProductSaved={vi.fn()}
            onReload={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('product specification amounts', () => {
  beforeEach(() => {
    vi.mocked(addProductSpecificationCode).mockReset().mockResolvedValue(null)
  })

  it('rejects a negative customs value and an absurd VAT inline and does not save', async () => {
    renderSpecification()
    fireEvent.change(await screen.findByRole('textbox', { name: 'Код специфікації' }), { target: { value: '8708301000' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Митна вартість' }), { target: { value: '-100' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'ПДВ' }), { target: { value: '99999999999999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(await screen.findByText('Значення не може бути відʼємним')).toBeTruthy()
    expect(screen.getByText('Занадто велике значення (максимум 1 000 000 000)')).toBeTruthy()
    expect(addProductSpecificationCode).not.toHaveBeenCalled()
  })

  it('saves valid amounts as numbers', async () => {
    renderSpecification()
    fireEvent.change(await screen.findByRole('textbox', { name: 'Код специфікації' }), { target: { value: '8708301000' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Митна вартість' }), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(addProductSpecificationCode).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ CustomsValue: 100, Duty: undefined, SpecificationCode: '8708301000', VATValue: undefined }),
    )
  })
})
