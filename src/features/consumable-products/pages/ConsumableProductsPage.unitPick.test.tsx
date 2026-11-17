import { MantineProvider } from '@mantine/core'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductEditorForm } from './ConsumableProductsPage'

const mocks = vi.hoisted(() => ({
  searchMeasureUnits: vi.fn(),
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

vi.mock('../api/consumableProductsApi', () => ({
  createConsumableProduct: vi.fn(),
  createConsumableProductCategory: vi.fn(),
  deleteConsumableProduct: vi.fn(),
  deleteConsumableProductCategory: vi.fn(),
  getConsumableProductCategories: vi.fn(),
  searchConsumableProductCategories: vi.fn(),
  searchMeasureUnits: mocks.searchMeasureUnits,
  updateConsumableProduct: vi.fn(),
  updateConsumableProductCategory: vi.fn(),
}))

describe('Новий товар: Одиниця виміру and Артикул', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView ??= () => {}
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.searchMeasureUnits.mockImplementation(async (value: string) => (
      value ? [] : [{ Id: 1, Name: 'компл' }, { Id: 2, Name: 'шт' }]
    ))
  })

  it('keeps the clicked unit and sends it with the product', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <MantineProvider>
        <ProductEditorForm
          editor={{ category: { ConsumableProducts: [], Id: 10, Name: 'Канцтовари' }, mode: 'create' }}
          isSubmitting={false}
          onClose={vi.fn()}
          onSubmit={onSubmit}
        />
      </MantineProvider>,
    )

    await waitFor(() => expect(mocks.searchMeasureUnits).toHaveBeenCalledWith(''))
    await user.type(screen.getByRole('textbox', { name: 'Назва' }), 'QA Товар')
    const unit = screen.getByRole('combobox', { name: 'Одиниця виміру' }) as HTMLInputElement
    await user.click(unit)
    await user.click(await screen.findByRole('option', { hidden: true, name: 'компл' }))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300))
    })

    expect(unit.value).toBe('компл')
    await user.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ measureUnit: expect.objectContaining({ Id: 1 }) }),
    )
  })

  it('limits Артикул to the 3 characters the server stores', () => {
    render(
      <MantineProvider>
        <ProductEditorForm
          editor={{ category: { ConsumableProducts: [], Id: 10, Name: 'Канцтовари' }, mode: 'create' }}
          isSubmitting={false}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      </MantineProvider>,
    )

    expect(screen.getByRole('textbox', { name: 'Артикул' }).getAttribute('maxlength')).toBe('3')
  })
})
