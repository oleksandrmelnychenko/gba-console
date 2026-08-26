import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

vi.mock('../../../shared/ui/SearchableSelect', () => ({
  SearchableSelect: ({
    data,
    label,
    onChange,
    onOptionSubmit,
    value,
  }: {
    data: Array<{ label: string; value: string }>
    label: string
    onChange?: (value: string) => void
    onOptionSubmit?: (value: string) => void
    value: string
  }) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={data.find((option) => option.label === value)?.value || ''}
        onChange={(event) => {
          const option = data.find((item) => item.value === event.currentTarget.value)
          onChange?.(option?.label || '')
          onOptionSubmit?.(event.currentTarget.value)
        }}
      >
        <option value="">Оберіть значення</option>
        {data.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  ),
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

describe('ConsumableProductsPage measure-unit selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.searchMeasureUnits.mockResolvedValue([
      { Id: 1, Name: 'послуга' },
      { Id: 2, Name: 'шт' },
    ])
  })

  it('preloads all company-resource units before the empty dropdown is opened', async () => {
    render(
      <MantineProvider>
        <ProductEditorForm
          categories={[
            { Id: 10, Name: 'Побутові товари і послуги', ConsumableProducts: [] },
          ]}
          editor={{
            category: { Id: 10, Name: 'Побутові товари і послуги', ConsumableProducts: [] },
            mode: 'create',
          }}
          isSubmitting={false}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      </MantineProvider>,
    )

    await waitFor(() => expect(mocks.searchMeasureUnits).toHaveBeenCalledWith(''))
    expect(await screen.findByText('послуга')).toBeTruthy()
    expect(screen.getByText('шт')).toBeTruthy()
  })

  it('lets a user choose the product category while creating a product', () => {
    const onSubmit = vi.fn()
    const categories = [
      { Id: 10, Name: 'Побутові товари і послуги', ConsumableProducts: [] },
      { Id: 20, Name: 'Витрати на доставку', ConsumableProducts: [] },
    ]

    render(
      <MantineProvider>
        <ProductEditorForm
          categories={categories}
          editor={{ category: categories[0], mode: 'create' }}
          isSubmitting={false}
          onClose={vi.fn()}
          onSubmit={onSubmit}
        />
      </MantineProvider>,
    )

    fireEvent.change(screen.getByRole('combobox', { name: 'Категорія' }), { target: { value: '20' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Назва' }), { target: { value: 'Послуги брокера' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'create' }),
      expect.objectContaining({ category: categories[1], name: 'Послуги брокера' }),
    )
  })

  it('does not allow editing to be saved after the measure unit is cleared', async () => {
    const onSubmit = vi.fn()
    const category = { Id: 10, Name: 'Побутові товари і послуги', ConsumableProducts: [] }

    render(
      <MantineProvider>
        <ProductEditorForm
          categories={[category]}
          editor={{
            category,
            mode: 'edit',
            product: { Id: 101, Name: 'Послуги брокера', MeasureUnit: { Id: 2, Name: 'шт' } },
          }}
          isSubmitting={false}
          onClose={vi.fn()}
          onSubmit={onSubmit}
        />
      </MantineProvider>,
    )

    await waitFor(() => expect(mocks.searchMeasureUnits).toHaveBeenCalledWith(''))
    expect(screen.getByRole('button', { name: 'Зберегти' }).hasAttribute('disabled')).toBe(false)

    fireEvent.change(screen.getByRole('combobox', { name: 'Одиниця виміру' }), { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'Зберегти' }).hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
